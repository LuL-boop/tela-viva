// Backend da IA: recebe { prompt } e devolve o texto da resposta em streaming.
// A chave da Anthropic fica só aqui, no servidor (variável ANTHROPIC_API_KEY).
import { timingSafeEqual } from 'node:crypto';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const BASE = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const MAX_TOKENS = Number(process.env.MAX_TOKENS) || 16000;
const MAX_PROMPT = 250_000;
const RATE_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR) || 40;

const SYSTEM =
  'You are the engine of a visual website builder. Follow the user instructions exactly. ' +
  'Reply with only the JSON that was requested: no prose, no markdown, no code fences.';

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (recent.length >= RATE_PER_HOUR) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

function sameCode(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 2_000_000) throw new Error('too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function fail(res, status, message) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return fail(res, 405, 'Use POST.'); }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fail(res, 500, 'ANTHROPIC_API_KEY não está configurada no servidor.');

  const need = process.env.ACCESS_CODE;
  if (need && !sameCode(req.headers['x-access-code'], need)) return fail(res, 401, 'Código de acesso inválido.');

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';
  if (limited(ip)) return fail(res, 429, 'Limite de uso por hora atingido.');

  let prompt;
  try { prompt = (await readBody(req)).prompt; } catch { return fail(res, 400, 'Corpo inválido.'); }
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT) return fail(res, 400, 'Prompt inválido.');

  const ac = new AbortController();
  res.on('close', () => ac.abort());

  let up;
  try {
    up = await fetch(`${BASE}/v1/messages`, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return fail(res, 502, 'Não consegui falar com a API da Anthropic.');
  }
  if (!up.ok) {
    const detail = await up.text().catch(() => '');
    console.error('Anthropic API', up.status, detail.slice(0, 500));
    return fail(res, up.status === 429 ? 429 : 502, 'A API da Anthropic recusou a chamada.');
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-accel-buffering', 'no');

  const reader = up.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') res.write(ev.delta.text);
        else if (ev.type === 'error') { console.error('stream error', ev.error); return res.end(); }
      }
    }
  } catch (e) {
    /* conexão encerrada pelo cliente ou pela API */
  }
  res.end();
}
