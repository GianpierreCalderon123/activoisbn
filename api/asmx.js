// Vercel Node.js Function: same-origin proxy to the existing ASMX service.
const ALLOWED = new Set([
  'ObtenerMaestroUsuariosSistema', 'ObtenerMaestroUbicacionesV2',
  'ObtenerMaestroUsuarios', 'ObtenerMaestroLocadores',
  'ObtenerMaestroActivosV2', 'InsUpdtTomaActivoIsnV2',
  'ValidarUsuarioSistema', 'ValidarUsuario'
]);
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const method = req.query.method;
  if (typeof method !== 'string' || !ALLOWED.has(method)) return res.status(404).json({ error: 'Unknown method' });
  const upstream = (process.env.INVENTARIO_ASMX_URL || 'https://inventariofw.somee.com/paginas.asmx').replace(/\/$/, '');
  const started = Date.now();
  const requestId = String(req.headers['x-inventory-request-id'] || '').slice(0,90);
  res.setHeader('X-Inventory-Proxy', 'vercel-asmx');
  if (requestId) res.setHeader('X-Inventory-Request-Id', requestId);
  try {
    const contentType = req.headers['content-type'] || 'application/json; charset=utf-8';
    const payload = contentType.includes('application/x-www-form-urlencoded')
      ? (typeof req.body === 'string' ? req.body : new URLSearchParams(req.body || {}).toString())
      : JSON.stringify(req.body || {});
    const response = await fetch(upstream + '/' + method, {
      method: 'POST', headers: { 'Content-Type': contentType, 'Accept': contentType.includes('application/x-www-form-urlencoded') ? '*/*' : 'application/json' },
      body: payload, signal: AbortSignal.timeout(25000)
    });
    const text = await response.text();
    res.setHeader('X-Inventory-Upstream-Status', String(response.status));
    res.setHeader('X-Inventory-Upstream-Ms', String(Date.now() - started));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.status(response.status).send(text);
  } catch (e) {
    res.setHeader('X-Inventory-Upstream-Status', 'unavailable');
    res.setHeader('X-Inventory-Upstream-Ms', String(Date.now() - started));
    return res.status(502).json({ error: 'Error al conectar con API de inventarios', detail: String(e.message), stage: 'vercel-to-somee', elapsedMs: Date.now() - started, requestId });
  }
};
