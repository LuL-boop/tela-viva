// Servidor local e para hospedagens Node (Render, Railway, Fly, VPS): npm start
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './api/ai.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Lê o arquivo .env, se existir (sem dependências)
try {
  for (const line of fs.readFileSync(path.join(dir, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PORT = Number(process.env.PORT) || 3000;

http
  .createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/ai') {
      try {
        const chunks = [];
        let size = 0;
        for await (const c of req) { size += c.length; if (size > 2_000_000) throw new Error('large'); chunks.push(c); }
        const raw = Buffer.concat(chunks).toString('utf8');
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        res.statusCode = 400;
        return res.end('bad request');
      }
      return handler(req, res);
    }
    if (pathname === '/' || pathname === '/index.html') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      return fs.createReadStream(path.join(dir, 'index.html')).pipe(res);
    }
    res.statusCode = 404;
    res.end('not found');
  })
  .listen(PORT, () => console.log(`Tela Viva em http://localhost:${PORT}`));
