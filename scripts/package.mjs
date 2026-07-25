import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ARTIFACTS = path.join(ROOT, 'artifacts');

const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
const archiveName = `brujula-vocacional-${packageJson.version}.zip`;
const archivePath = path.join(ARTIFACTS, archiveName);

try {
  await access(path.join(DIST, 'index.html'));
} catch {
  console.error('No existe un build válido. Ejecuta "npm run build" primero.');
  process.exit(1);
}

await mkdir(ARTIFACTS, { recursive: true });
await rm(archivePath, { force: true });

const output = createWriteStream(archivePath);
const archive = archiver('zip', { zlib: { level: 9 } });

const completed = new Promise((resolve, reject) => {
  output.on('close', resolve);
  output.on('error', reject);
  archive.on('warning', (error) => {
    if (error.code === 'ENOENT') console.warn(error.message);
    else reject(error);
  });
  archive.on('error', reject);
});

archive.pipe(output);
archive.directory(DIST, false);
await archive.finalize();
await completed;

const size = (await stat(archivePath)).size;
const manifest = {
  name: archiveName,
  version: packageJson.version,
  createdAt: new Date().toISOString(),
  bytes: size,
  sourceDirectory: 'dist',
};
await writeFile(path.join(ARTIFACTS, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log('✓ Paquete generado');
console.log(`  ${path.relative(ROOT, archivePath)}`);
console.log(`  ${(size / 1024).toFixed(1)} KB`);
