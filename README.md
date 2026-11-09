# InventarioFW PWA — paquete para GitHub + Vercel

## Despliegue
1. Crear repositorio privado en GitHub y subir **el contenido de esta carpeta a la raíz** del repositorio.
2. En Vercel: Add New > Project > Import Git Repository.
3. Framework Preset: Other. Root Directory: `./`. No build command (sitio estático con funciones Node).
4. Configurar variable opcional `INVENTARIO_ASMX_URL=https://inventariofw.somee.com/paginas.asmx`.
5. Deploy. Abrir la URL HTTPS en Safari > Compartir > Añadir a pantalla de inicio.

## Estado y limitaciones IMPORTANTES
- Se incluyó proxy serverless para métodos ASMX conocidos. **No se ha validado contra la API real**, sus contratos ni los permisos de Vercel.
- `api/upload-image.js` devuelve deliberadamente HTTP 501: **la subida de fotografías NO está implementada**, ya que el backend anterior usaba `http://190.116.22.130:2384/...` y no se ha comprobado su accesibilidad/seguridad, ni los límites de tamaño en Vercel. Los registros con fotos quedarán pendientes. No utilizar en producción.
- `InsUpdtTomaActivoIsnV2` aún necesita validación estricta de confirmación remota e idempotencia antes de operar con datos reales.
- La PWA existente no replica todos los diseños y reglas de Android. Es un punto de partida, no migración final certificada.
- **Seguridad:** las rutas proxy actuales no autentican al cliente por sí mismas. Antes de exponer datos, implementar autenticación y autorización del lado del servidor, rate limiting y restringir origen/uso. El login de la UI no protege el proxy. No publicar datos reales hasta corregir esto.
- En iOS el almacenamiento IndexedDB puede ser eliminado. No sustituye un respaldo permanente.
- El plan Hobby de Vercel puede no ser adecuado para uso comercial. Consultar las condiciones del plan.
- La sincronización es manual. La app requiere primera carga con internet y HTTPS para instalarse.

## Archivos
- `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`: PWA web.
- `config.js`: endpoints relativos de Vercel.
- `api/asmx.js`: proxy de métodos ASMX con lista permitida.
- `api/upload-image.js`: endpoint bloqueado de forma segura hasta completar integración.
- `vercel.json`: configuración de funciones y cabeceras.
