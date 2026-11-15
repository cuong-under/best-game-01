// A minimal static server for game/ (Node 22, standard library only), for playing
// the entry locally without a build step: `node serve.ts` serves game/ on
// http://localhost:8080 (or `--port <n>`). It answers only files inside game/ and
// sends the content types a browser game needs. A development convenience, not a
// server for the internet.

import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameDir = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const wanted = portFlag === -1 ? 8080 : Number(args[portFlag + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  const target = resolve(join(gameDir, decoded === '/' ? 'index.html' : decoded));
  if (target !== gameDir && !target.startsWith(gameDir + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  try {
    if (!statSync(target).isFile()) throw new Error('not a file');
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  const body = readFileSync(target);
  response.writeHead(200, {
    'content-type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  response.end(body);
}).listen(port, '127.0.0.1', () => {
  console.log(`The Last Lantern is on http://localhost:${port}`);
});
