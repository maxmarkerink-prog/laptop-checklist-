'use strict';

// Laptopcheck: kleine Node-server zonder externe pakketten.
// Serveert de app uit /public en slaat rapporten op als JSON in /reports.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1'; // alleen bereikbaar op deze laptop
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORT_DIR = path.join(__dirname, 'reports');
const MAX_BODY = 1024 * 1024; // 1 MB

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

fs.mkdirSync(REPORT_DIR, { recursive: true });

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}
const json = (res, status, data) => send(res, status, JSON.stringify(data));
const text = (res, status, msg) => send(res, status, msg, 'text/plain; charset=utf-8');

// Maakt een veilige bestandsnaam van gebruikersinvoer.
const safe = s =>
  String(s || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'onbekend';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Rapport is te groot'));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function saveReport(req, res) {
  let report;
  try {
    report = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: 'Het rapport is geen geldige JSON' });
  }
  if (!report || !report.toestel || !String(report.toestel.serial || '').trim()) {
    return json(res, 400, { error: 'Serienummer ontbreekt' });
  }
  const day = String(report.datum || new Date().toISOString()).slice(0, 10);
  const file = `${safe(day)}_${safe(report.toestel.serial)}_${safe(report.id)}.json`;
  report.opgeslagen = new Date().toISOString();
  await fs.promises.writeFile(path.join(REPORT_DIR, file), JSON.stringify(report, null, 2), 'utf8');
  console.log(`Rapport opgeslagen: ${file} (${report.uitkomst})`);
  json(res, 201, { ok: true, file });
}

async function listReports(res) {
  const files = (await fs.promises.readdir(REPORT_DIR)).filter(f => f.endsWith('.json'));
  const list = [];
  for (const f of files) {
    try {
      const r = JSON.parse(await fs.promises.readFile(path.join(REPORT_DIR, f), 'utf8'));
      list.push({
        bestand: f,
        datum: r.datum,
        serienummer: r.toestel?.serial || '',
        model: r.toestel?.model || '',
        door: r.toestel?.tech || '',
        uitkomst: r.uitkomst || '',
      });
    } catch {
      // Beschadigd bestand overslaan
    }
  }
  list.sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  json(res, 200, list.slice(0, 50));
}

async function serveStatic(pathname, res) {
  const rel = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return text(res, 403, 'Verboden');
  try {
    const data = await fs.promises.readFile(file);
    send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
  } catch {
    text(res, 404, 'Niet gevonden');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/reports' && req.method === 'POST') return await saveReport(req, res);
    if (pathname === '/api/reports' && req.method === 'GET') return await listReports(res);
    if (req.method === 'GET') return await serveStatic(pathname, res);
    text(res, 405, 'Methode niet toegestaan');
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: 'Serverfout' });
  }
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Poort ${PORT} is al in gebruik. Start op een andere poort, bijvoorbeeld 3001 (zie README).`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`Laptopcheck draait op http://localhost:${PORT}`);
  console.log(`Rapporten worden opgeslagen in ${REPORT_DIR}`);
});
