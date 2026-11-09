# InventarioFW PWA – revisión de sincronización

## Cambios
- Se ocultaron los campos adicionales no necesarios (tipo de activo, código 2020, material, etc.) y se separaron Estado y Fotografías en sus pestañas respectivas.
- Se corrigió el proxy ASMX para enviar datos form-urlencoded sin convertirlos a JSON.
- Se agregó proxy multipart para fotografías, con compresión en navegador.
- Se mantiene sincronización exclusivamente manual.

## Configuración obligatoria en Vercel
- `INVENTARIO_ASMX_URL=https://inventariofw.somee.com/paginas.asmx`
- `INVENTARIO_IMAGE_URL=https://TU-SERVIDOR-SEGURO/ApiImagenesApp/Image/UploadImage`

**Bloqueante:** La aplicación Android usa `http://190.116.22.130:2384/ApiImagenesApp/Image/UploadImage`. No es HTTPS y no hay prueba de que el servicio esté accesible por HTTPS. Para fotos hace falta publicar ese endpoint mediante HTTPS (dominio/proxy con certificado válido) y establecer la variable anterior. No se debe asumir que Vercel puede acceder a la IP/puerto ni publicar un proxy inseguro.

## Validación pendiente
- Comprobar contrato exacto de respuesta de `InsUpdtTomaActivoIsnV2` con una toma de prueba y revisar que SQL Server realmente la recibió. Actualmente la respuesta exitosa HTTP no demuestra por sí sola que la base de datos confirmó el guardado.
- Probar subida de foto 1, 2 y 3, y nombres esperados por servidor.
- Comprobar equivalencia exacta de los campos ocultos con la última versión de Android.
- Endurecer autenticación/autorización del proxy antes de producción; ahora los endpoints son públicos.
- No utilizar inventarios reales hasta finalizar estas pruebas.

## Publicación
Subir archivos a raíz del repositorio GitHub; en Vercel seleccionar Framework Other, configurar variables de entorno e instalar dependencias con npm. El plan gratuito de Vercel puede no ser adecuado para uso empresarial.


## Actualización de formulario y sincronización (rama de revisión)
- Selectores offline para ubicación, usuario asignado y locador. Al seleccionar ubicación se completan descripción, coordinación, subunidad y unidad orgánica.
- Se retiran campos extra de asignación y se evita que fotos ocultas bloqueen guardar la toma offline.
- Las respuestas XML simples de ASMX se procesan al enviar formularios; errores HTTP muestran detalle resumido.
- Botón de reintento de fotografías. Requiere configurar `INVENTARIO_IMAGE_URL` como endpoint HTTPS accesible en Vercel; no está verificado el envío en producción.
- Los registros ya guardados en IndexedDB no se borran al actualizar. Si un intento previo recibió una respuesta no JSON, verificar en SQL Server si la toma existe antes de reintentar para evitar duplicados.
- Estos cambios requieren pruebas reales de punta a punta antes de integrarlos en `main`.
