import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');

const readJson = async (filePath) => {
  const raw = await readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`JSON inválido en ${path.relative(ROOT, filePath)}: ${error.message}`);
  }
};

const resolveDataReference = (reference) => {
  const clean = String(reference || '').replace(/^\.\//, '');
  return path.resolve(ROOT, clean);
};

const splitList = (value, separator = ',') => String(value || '')
  .split(separator)
  .map((item) => item.trim())
  .filter(Boolean);

const normalizeName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const parseConstraints = (value) => Object.fromEntries(
  splitList(value).map((item) => {
    const [key, rawLevel] = item.split(':');
    return [key, Number(rawLevel)];
  }),
);

export async function loadProjectData() {
  const [test, overrides, config, careerManifest] = await Promise.all([
    readJson(path.join(DATA_DIR, 'test.json')),
    readJson(path.join(DATA_DIR, 'test-overrides.json')),
    readJson(path.join(DATA_DIR, 'app-config.json')),
    readJson(path.join(DATA_DIR, 'careers.json')),
  ]);

  const parts = await Promise.all(
    (careerManifest.parts || []).map((reference) => readJson(resolveDataReference(reference))),
  );
  const familyData = careerManifest.families
    ? await readJson(resolveDataReference(careerManifest.families))
    : { families: {} };

  return { test, overrides, config, careerManifest, parts, familyData };
}

export async function validateProjectData({ silent = false } = {}) {
  const data = await loadProjectData();
  const { test, overrides, careerManifest, parts, familyData } = data;
  const errors = [];
  const warnings = [];

  const aptitudeKeys = new Set(Object.keys(test.dimensions?.aptitudes || {}));
  const valueKeys = new Set(Object.keys(test.dimensions?.values || {}));
  const interestKeys = new Set(Object.keys(test.dimensions?.interests || {}));
  const constraintKeys = new Set(Object.keys(test.dimensions?.constraints || {}));
  const familyNames = careerManifest.familyNames || [];

  if (!Array.isArray(careerManifest.parts) || careerManifest.parts.length === 0) {
    errors.push('data/careers.json debe declarar al menos una parte en "parts".');
  }
  if (!Array.isArray(familyNames) || familyNames.length === 0) {
    errors.push('data/careers.json debe declarar "familyNames".');
  }
  if (!familyData.families || typeof familyData.families !== 'object') {
    errors.push('data/career-families.json debe contener un objeto "families".');
  }

  const rows = parts.flatMap((part, partIndex) => {
    if (!Array.isArray(part.rows)) {
      errors.push(`La parte ${partIndex + 1} no contiene un arreglo "rows".`);
      return [];
    }
    return part.rows;
  });

  if (careerManifest.count !== rows.length) {
    errors.push(`El manifiesto declara ${careerManifest.count} carreras, pero las partes contienen ${rows.length}.`);
  }

  const ids = new Map();
  const names = new Map();
  const representedFamilies = new Set();
  const representedClusters = new Set();

  rows.forEach((row, index) => {
    const label = `Carrera #${index + 1}`;
    if (!Array.isArray(row) || row.length < 12) {
      errors.push(`${label}: la fila debe contener al menos 12 columnas.`);
      return;
    }

    const [id, name, familyIndex, cluster, hollandCode, rawAptitudes, rawValues, rawSpecializations, rawConstraints, rawHardConstraints, educationLevel, description] = row;
    const normalized = normalizeName(name);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(id || ''))) {
      errors.push(`${label}: ID inválido "${id}".`);
    }
    if (ids.has(id)) errors.push(`${label}: ID duplicado "${id}"; ya aparece en #${ids.get(id)}.`);
    else ids.set(id, index + 1);

    if (!normalized) errors.push(`${label}: nombre vacío.`);
    if (names.has(normalized)) errors.push(`${label}: nombre duplicado "${name}"; ya aparece en #${names.get(normalized)}.`);
    else names.set(normalized, index + 1);

    if (!Number.isInteger(familyIndex) || familyIndex < 0 || familyIndex >= familyNames.length) {
      errors.push(`${label} (${name}): índice de familia inválido "${familyIndex}".`);
    } else {
      representedFamilies.add(familyIndex);
    }

    if (!cluster) errors.push(`${label} (${name}): falta el clúster profesional.`);
    else representedClusters.add(cluster);

    if (!/^[RIASEC]{3}$/.test(String(hollandCode || ''))) {
      errors.push(`${label} (${name}): código Holland inválido "${hollandCode}".`);
    }

    const careerAptitudes = splitList(rawAptitudes);
    const careerValues = splitList(rawValues);
    const specializations = splitList(rawSpecializations, '|');
    const constraints = parseConstraints(rawConstraints);
    const hardConstraints = splitList(rawHardConstraints);

    if (careerAptitudes.length < 3) warnings.push(`${name}: tiene menos de tres aptitudes configuradas.`);
    careerAptitudes.forEach((key) => {
      if (!aptitudeKeys.has(key)) errors.push(`${name}: aptitud desconocida "${key}".`);
    });

    if (careerValues.length < 2) warnings.push(`${name}: tiene menos de dos valores configurados.`);
    careerValues.forEach((key) => {
      if (!valueKeys.has(key)) errors.push(`${name}: valor desconocido "${key}".`);
    });

    if (specializations.length < 3) errors.push(`${name}: debe incluir al menos tres especializaciones.`);
    const uniqueSpecializations = new Set(specializations.map(normalizeName));
    if (uniqueSpecializations.size !== specializations.length) errors.push(`${name}: contiene especializaciones duplicadas.`);

    Object.entries(constraints).forEach(([key, level]) => {
      if (!constraintKeys.has(key)) errors.push(`${name}: restricción desconocida "${key}".`);
      if (!Number.isInteger(level) || level < 1 || level > 5) errors.push(`${name}: nivel inválido para ${key}: ${level}.`);
    });
    hardConstraints.forEach((key) => {
      if (!constraintKeys.has(key)) errors.push(`${name}: restricción fuerte desconocida "${key}".`);
      if (!(key in constraints)) warnings.push(`${name}: ${key} es fuerte, pero no aparece en sus restricciones graduadas.`);
    });

    if (!educationLevel) errors.push(`${name}: falta el nivel formativo.`);
    if (!description || String(description).length < 25) errors.push(`${name}: descripción ausente o demasiado corta.`);
  });

  familyNames.forEach((family, index) => {
    if (!representedFamilies.has(index)) errors.push(`La familia "${family}" no tiene carreras.`);
  });

  const questionIds = new Set();
  let questionCount = 0;
  (test.blocks || []).forEach((block) => {
    if (!Array.isArray(block.questions) || block.questions.length === 0) {
      errors.push(`El bloque "${block.id}" no contiene preguntas.`);
      return;
    }

    block.questions.forEach((question) => {
      questionCount += 1;
      if (questionIds.has(question.id)) errors.push(`Pregunta duplicada: ${question.id}.`);
      questionIds.add(question.id);
      if (!question.prompt) errors.push(`${question.id}: falta el enunciado.`);
      if (!Array.isArray(question.options) || question.options.length < 2) errors.push(`${question.id}: necesita al menos dos opciones.`);

      const optionIds = new Set();
      (question.options || []).forEach((option) => {
        if (optionIds.has(option.id)) errors.push(`${question.id}: opción duplicada "${option.id}".`);
        optionIds.add(option.id);
      });

      if (block.id === 'interests' && !interestKeys.has(question.dimension)) {
        errors.push(`${question.id}: dimensión de interés desconocida "${question.dimension}".`);
      }
      if (block.id === 'situations') {
        (question.options || []).forEach((option) => {
          if (!interestKeys.has(option.dimension)) errors.push(`${question.id}/${option.id}: dimensión RIASEC desconocida "${option.dimension}".`);
        });
      }
      if (block.id === 'aptitudes' && !aptitudeKeys.has(question.dimension)) {
        errors.push(`${question.id}: aptitud desconocida "${question.dimension}".`);
      }
      if (block.id === 'values' && !valueKeys.has(question.dimension)) {
        errors.push(`${question.id}: valor desconocido "${question.dimension}".`);
      }
      if (block.id === 'constraints' && !constraintKeys.has(question.dimension)) {
        errors.push(`${question.id}: restricción desconocida "${question.dimension}".`);
      }
    });
  });

  Object.entries(overrides.questions || {}).forEach(([questionId, patch]) => {
    if (!questionIds.has(questionId)) errors.push(`test-overrides.json referencia una pregunta inexistente: ${questionId}.`);
    if (patch.optionSet && !overrides.sharedOptions?.[patch.optionSet]) {
      errors.push(`${questionId}: optionSet inexistente "${patch.optionSet}".`);
    }
  });

  if (questionCount !== 149) warnings.push(`El cuestionario contiene ${questionCount} preguntas; la versión esperada actualmente contiene 149.`);
  if (representedClusters.size < 20) warnings.push(`Solo hay ${representedClusters.size} clústeres; conviene revisar la diversificación del catálogo.`);

  if (errors.length) {
    const preview = errors.slice(0, 50).map((error) => `- ${error}`).join('\n');
    const omitted = errors.length > 50 ? `\n- …y ${errors.length - 50} errores adicionales.` : '';
    throw new Error(`Validación fallida con ${errors.length} error(es):\n${preview}${omitted}`);
  }

  const stats = {
    questions: questionCount,
    careers: rows.length,
    families: representedFamilies.size,
    clusters: representedClusters.size,
    warnings,
  };

  if (!silent) {
    console.log('✓ Datos vocacionales válidos');
    console.log(`  Preguntas: ${stats.questions}`);
    console.log(`  Carreras: ${stats.careers}`);
    console.log(`  Familias: ${stats.families}`);
    console.log(`  Clústeres: ${stats.clusters}`);
    warnings.forEach((warning) => console.warn(`  Aviso: ${warning}`));
  }

  return { ...data, rows, stats };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  validateProjectData().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
