// Local server for บอร์ดโฟกัส: serves index.html and keeps tasks in data/tasks.json.
// No dependencies. Run: node server.js  (PORT env var to change the port)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tasks.json');
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function load() {
  try {
    const obj = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

let tasks = load();

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(tasks, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 64 * 1024) { reject(new Error('too large')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/' || url.pathname === '/index.html') {
    return send(res, 200, fs.readFileSync(path.join(ROOT, 'index.html')), 'text/html; charset=utf-8');
  }

  if (url.pathname === '/api/tasks' && req.method === 'GET') {
    return send(res, 200, Object.entries(tasks).map(([id, t]) => ({ ...t, id })));
  }

  const m = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (!ID_RE.test(id)) return send(res, 400, { error: 'bad id' });

    if (req.method === 'PUT') {
      try {
        const body = JSON.parse(await readBody(req));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
        delete body.id;
        tasks[id] = body;
        persist();
        return send(res, 200, { ok: true });
      } catch (e) {
        return send(res, 400, { error: String(e.message || e) });
      }
    }
    if (req.method === 'DELETE') {
      delete tasks[id];
      persist();
      return send(res, 200, { ok: true });
    }
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`บอร์ดโฟกัส → http://localhost:${PORT}`);
  console.log(`tasks are saved in ${path.relative(process.cwd(), DATA_FILE) || DATA_FILE}`);
});
