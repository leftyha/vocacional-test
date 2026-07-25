import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import { validateProjectData } from './validate-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ASSETS = path.join(DIST, 'assets');
const DATA_SOURCE = path.join(ROOT, 'data');
const DATA_DIST = path.join(DIST, 'data');

const SCRIPT_FILES = [
  'engine.js',
  'algorithm-core-v2.js',
  'algorithm-results-v2.js',
  'motion.js',
  'radar.js',
  'data-loader.js',
  'app.js',
  'auto-advance.js',
];

const hashContent = (content) => crypto
  .createHash('sha256')
  .update(content)
  .digest('hex')
  .slice(0, 12);

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const ensureInstalled = async (filePath, packageName) => {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Falta ${packageName}. Ejecuta "npm install" antes de compilar.`);
  }
};

const minifyHtml = (html) => html
  .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
  .replace(/>\s+</g, '><')
  .replace(/\s{2,}/g, ' ')
  .trim();

async function copyDataDirectory(source, destination) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDataDirectory(sourcePath, destinationPath);
      return;
    }

    if (entry.name.endsWith('.json')) {
      const parsed = JSON.parse(await readFile(sourcePath, 'utf8'));
      await writeFile(destinationPath, `${JSON.stringify(parsed)}\n`, 'utf8');
      return;
    }

    await cp(sourcePath, destinationPath);
  }));
}

async function directorySize(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  let total = 0;
  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) total += await directorySize(filePath);
    else total += (await stat(filePath)).size;
  }
  return total;
}

async function build() {
  const validation = await validateProjectData({ silent: true });
  const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const animePath = path.join(ROOT, 'node_modules', 'animejs', 'lib', 'anime.min.js');
  await ensureInstalled(animePath, 'animejs');

  await rm(DIST, { recursive: true, force: true });
  await mkdir(ASSETS, { recursive: true });

  const animeSource = await readFile(animePath, 'utf8');
  const compiledScripts = [];

  for (const fileName of SCRIPT_FILES) {
    const filePath = path.join(ROOT, fileName);
    await access(filePath);
    let source = await readFile(filePath, 'utf8');

    // El build ya incorpora Anime.js localmente; evita una segunda descarga desde CDN.
    if (fileName === 'app.js') {
      source = source.replace(
        /window\.addEventListener\(['"]load['"],\s*loadAnimeEnhancement,\s*\{\s*once:\s*true\s*\}\);?/g,
        '',
      );
    }

    const result = await transform(source, {
      loader: 'js',
      minify: true,
      target: 'es2020',
      legalComments: 'none',
      charset: 'utf8',
    });
    compiledScripts.push(`/* ${fileName} */\n${result.code}`);
  }

  const javascript = `${animeSource}\n${compiledScripts.join('\n;\n')}`;
  const javascriptHash = hashContent(javascript);
  const javascriptName = `app.${javascriptHash}.js`;
  await writeFile(path.join(ASSETS, javascriptName), javascript, 'utf8');

  const cssSource = await readFile(path.join(ROOT, 'styles.css'), 'utf8');
  const cssResult = await transform(cssSource, {
    loader: 'css',
    minify: true,
    target: 'es2020',
    legalComments: 'none',
    charset: 'utf8',
  });
  const cssHash = hashContent(cssResult.code);
  const cssName = `styles.${cssHash}.css`;
  await writeFile(path.join(ASSETS, cssName), cssResult.code, 'utf8');

  let html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  html = html
    .replace(/<link\s+rel=["']stylesheet["'][^>]*>/i, `<link rel="stylesheet" href="./assets/${cssName}">`)
    .replace(/\s*<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>/gi, '')
    .replace('</head>', `<meta name="application-version" content="${packageJson.version}"></head>`)
    .replace('</body>', `<script src="./assets/${javascriptName}" defer></script></body>`);
  await writeFile(path.join(DIST, 'index.html'), `${minifyHtml(html)}\n`, 'utf8');

  await copyDataDirectory(DATA_SOURCE, DATA_DIST);

  for (const optionalFile of ['manifest.webmanifest', 'robots.txt']) {
    const sourcePath = path.join(ROOT, optionalFile);
    try {
      await access(sourcePath);
      await cp(sourcePath, path.join(DIST, optionalFile));
    } catch {
      // El archivo es opcional.
    }
  }

  await writeFile(path.join(DIST, '.nojekyll'), '', 'utf8');
  await writeFile(path.join(DIST, 'build-info.json'), `${JSON.stringify({
    name: packageJson.name,
    version: packageJson.version,
    builtAt: new Date().toISOString(),
    assets: { javascript: javascriptName, css: cssName },
    questions: validation.stats.questions,
    careers: validation.stats.careers,
    families: validation.stats.families,
    clusters: validation.stats.clusters,
  }, null, 2)}\n`, 'utf8');

  const size = await directorySize(DIST);
  console.log('✓ Build completado');
  console.log(`  Salida: ${path.relative(ROOT, DIST)}/`);
  console.log(`  JavaScript: assets/${javascriptName}`);
  console.log(`  CSS: assets/${cssName}`);
  console.log(`  Datos: ${validation.stats.careers} carreras y ${validation.stats.questions} preguntas`);
  console.log(`  Tamaño total: ${formatBytes(size)}`);
}

build().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
});
