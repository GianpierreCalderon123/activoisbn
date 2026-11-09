// Multipart uploads via Vercel have request size limits. Validate on real iPhones.
module.exports = async function handler(req, res) {
  return res.status(501).json({
    error: 'La subida de fotos requiere configurar un destino HTTPS compatible con Vercel y verificar el contrato multipart. No se marca como sincronizada.'
  });
};
