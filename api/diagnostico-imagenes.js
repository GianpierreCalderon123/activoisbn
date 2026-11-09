// Diagnostic-only probe. Never uploads photos or changes inventory data.
// Set INVENTARIO_DIAG_TOKEN in Vercel environment settings before use.
const crypto = require('node:crypto');
const http = require('node:http');
const TARGET_HOST = '190.116.22.130';
const TARGET_PORT = 2384;
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const secret = process.env.INVENTARIO_DIAG_TOKEN;
  if (!secret || secret.length < 24) return res.status(503).json({ error: 'Diagnostic disabled: set INVENTARIO_DIAG_TOKEN (24+ characters) in Vercel' });
  const supplied = req.headers['x-diagnostic-token'];
  const token = typeof supplied === 'string' ? supplied : '';
  const a = Buffer.from(token), b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unauthorized' });
  const started = Date.now();
  const result = await new Promise(resolve => {
    const request = http.request({
      hostname: TARGET_HOST, port: TARGET_PORT, path: '/', method: 'GET',
      agent: false, timeout: 6500,
      headers: { 'User-Agent': 'InventarioFW-connectivity-check/1.0', 'Connection': 'close' }
    }, upstream => {
      const status = upstream.statusCode;
      upstream.resume();
      upstream.on('end', () => resolve({ reachable: true, httpStatus: status, durationMs: Date.now() - started }));
      upstream.on('error', e => resolve({ reachable: true, httpStatus: status, errorCode: e.code || 'RESPONSE_ERROR', durationMs: Date.now() - started }));
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    request.on('error', e => resolve({ reachable: false, errorCode: e.code || 'NETWORK_ERROR', durationMs: Date.now() - started }));
    request.end();
  });
  // Any HTTP status (including 404/405) proves that the origin accepted a connection.
  return res.status(200).json({ target: 'HTTP image server, port 2384', method: 'GET / (read-only)', ...result });
};
