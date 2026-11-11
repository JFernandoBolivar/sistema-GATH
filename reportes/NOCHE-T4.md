# NOCHE T4 — Formulario de fe de vida y rutas de carga masiva (frontend)

**Fecha:** 2026-11-11 · **Sin commit**

## F2-08 — Un error de SWR desmontaba el formulario

`fe-de-vida-pasivo-page.tsx`: el error de `vigente`/`detalle` solo reemplaza la
pantalla si **no hay datos** (`vigente.error && !vigente.data`; el detalle se
muestra como error solo si `!detalle.data`). Ambos SWR con
`revalidateOnFocus: false`, para que volver de otra app no recargue ni borre lo
escrito.

## F2-09 — Excepciones de red al guardar y enviar

`formulario-fe-de-vida.tsx`: `guardarYAvanzar` y el envío van en `try/catch`; si
la Server Action rechaza (sin red) se muestra un toast y **se conservan los
ítems** del paso. `empezar()` (página) igual.

## F2-10 — No reintentar 400 y mostrar la causa real

`subida-con-reintento.ts`: nueva `reintentarSoloSiEsTransporte` (solo se
reintenta si la llamada lanzó; una respuesta con `ok:false` no se repite). El
formulario la usa y muestra `res.mensaje` del servidor en vez del texto genérico
de conexión.

## F2-11 — Tamaño validado después de reducir

`formulario-fe-de-vida.tsx`: tras `reducirFoto` se comprueba
`archivoReducido.size <= MAX_BYTES_FOTO` (5 MB) y se avisa. `paso-foto.tsx`
admite originales de hasta 25 MB en `CapturaFoto`, porque el límite real es el
de la foto reducida.

## F2-13 — La foto local caduca

`foto-local-storage.ts`: `HORAS_VIGENCIA_FOTO_LOCAL = 24`; al recuperar, si
`guardadoEn` es más antiguo se descarta y se borra del almacén.

## F2-14 — Cámara al desmontar

Verificado: `captura-foto.tsx` ya detiene las pistas en el `cleanup` del efecto
(`detener()`), incluido el desmontaje. Sin cambios.

## F2-16 — País por defecto mientras carga el catálogo

`paso-contacto.tsx`: `esVenezuela` solo se asume cuando **no existe** vivienda
(país por defecto del sistema). Si hay vivienda y el país aún no está resuelto,
no se fuerza Venezuela.

## F2-06 / F2-17 — Rutas de carga masiva

- `plantilla`, `subir` y `resultados` usan `apiClient` (`getBlob`/`postForm`)
  en vez del cliente heredado.
- Nuevo `shared/infrastructure/http/respuesta-error.ts`: `estadoDeError`
  (ApiHttpError→su código, SessionExpired→401, resto 500) y `mensajeDeError`.
- `resultados` valida el `id` como UUID antes de llamar a Django (400 si no).
- Los errores del backend ya no se entregan como un `.xlsx`/200: salen como
  error con su código real.

## F2-15 — Errores de la ficha pública del carnet

`fetcher-api.ts`: un 403 ya no usa el texto fijo «No tienes permiso…»; se lee el
mensaje del backend (con ese texto como reserva), así la ficha pública explica
si la credencial no es válida o el dato está restringido.

## Pruebas y verificación

- `npx vitest run src/modules/fe-de-vida src/shared/components/captura-foto`:
  **198 passed**; `subida-con-reintento.test.ts` **4 passed** con el caso nuevo
  «no reintenta un 400, sí un fallo de red».
- `npx tsc --noEmit`: 0 errores. `npx eslint src --quiet`: 0 errores.

## Pendiente

- No hay prueba de componente para el formulario completo (el flujo se cubre en
  E2E y en las pruebas de página existentes).
- Los `*.tmp.mjs` de la raíz de NextJS son de otros agentes; no se tocan.
