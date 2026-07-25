import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const readFlag = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const positional = args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--host' && args[index - 1] !== '--port');

const root = path.resolve(positional || '.');
const host = readFlag('--host', '127.0.0.1');
const port = Number(readFlag('--port', '4173'));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Puerto inválido. Usa un número entre 1 y 65535.');
  process.exit(1);
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const sendText = (response, status, message) => {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(message);
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    let filePath = path.resolve(root, relativePath);

    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      sendText(response, 403, 'Acceso denegado');
      return;
    }

    let fileStat;
    try {
      fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        fileStat = await stat(filePath);
      }
    } catch {
      sendText(response, 404, 'Archivo no encontrado');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Content-Length': fileStat.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch (error) {
    sendText(response, 500, `Error interno: ${error.message}`);
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${port} ya está ocupado. Prueba: npm run preview -- --port 8080`);
  } else {
    console.error(error.message);
  }
  process.exitCode = 1;
});

server.listen(port, host, async () => {
  try {
    await access(path.join(root, 'index.html'));
  } catch {
    console.warn(`Aviso: no existe ${path.join(root, 'index.html')}`);
  }

  console.log(`Sirviendo: ${root}`);
  console.log(`En este equipo: http://127.0.0.1:${port}`);

  if (host === '0.0.0.0' || host === '::') {
    const addresses = Object.values(os.networkInterfaces())
      .flat()
      .filter((item) => item && item.family === 'IPv4' && !item.internal)
      .map((item) => item.address);
    [...new Set(addresses)].forEach((address) => {
      console.log(`En la red LAN: http://${address}:${port}`);
    });
  }

  console.log('Presiona Ctrl+C para detener el servidor.');
});
