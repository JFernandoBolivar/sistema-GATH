# NOCHE T2 — Verificación del QR (F2-04) y límites por IP (F2-05)

**Fecha:** 2026-11-11 · **Sin commit**

## F2-04 — «No fue posible verificar» con la sesión vencida

**Causa.** La verificación interna se ejecuta desde el render de la página. Si
`dj_access` venció (15 min), se intentaba refrescar: Django rotaba y ponía en
lista negra el refresh, pero el Server Component no puede escribir cookies, así
que el par nuevo se perdía y el error (sin `status`) acababa en el mensaje
genérico. Resultado: constancia real no verificada y sesión quemada.

**Corrección (sin cambio de interfaz).**
1. `NextJS/src/shared/infrastructure/http/fetcher-api.ts`:
   - `RequestOptions.sinRefresco`: con `true`, `getAccessToken()` devuelve el
     token existente o `null` y **no** llama a `refreshTokens()`.
   - con 401 y `sinRefresco`, lanza `SessionExpiredError` (sin POST de refresh).
   - la misma regla en la descarga de blobs.
2. `NextJS/src/modules/fe-de-vida/infrastructure/http/fe-de-vida-api.ts`:
   `verificacionInterna` se pide con `{ sinRefresco: true }`.
3. `NextJS/src/modules/fe-de-vida/application/use-cases/verificar-constancia.ts`:
   cualquier fallo de la vía interna distinto de 404/429 (sesión vencida, 401,
   403, 5xx, red) devuelve `sin-permiso` y **cae a la vía pública**, que no
   depende de la sesión. El 404 sigue siendo «inválida» y el 429 mantiene su
   mensaje de límite.

**Pruebas** (`verificar-constancia.test.ts`): sesión vencida sin `status` → cae
a la pública y la llama; 5xx interno → cae a la pública; 404 interno → inválida
sin consultar la pública. 8/8 en verde.

## F2-05 — El throttling por IP veía siempre la IP de Next

**Corrección.**
1. `NextJS/src/shared/infrastructure/http/ip-cliente.ts` (nuevo): lee
   `x-forwarded-for` (primer salto) o `x-real-ip` de la petición entrante.
2. `fetcher-api.ts` (usado por fe de vida y carnetización) y
   `src/lib/api-client.ts` (server actions y rutas API) envían
   `X-Forwarded-For` con esa IP en todas las llamadas a Django.
3. `BACKEND/GATH/settings.py`: `REST_FRAMEWORK['NUM_PROXIES']` =
   `DJANGO_NUM_PROXIES` (por defecto **1**). Con 1, DRF toma la IP del
   `X-Forwarded-For` que pone Next en vez de la IP del contenedor; sin la
   cabecera sigue usando `REMOTE_ADDR`.
4. Documentada la variable en `BACKEND/.env.example`.

**Prueba** (`tests/unit/core/test_throttles.py`): con `NUM_PROXIES=1`,
`X-Forwarded-For: 203.0.113.7` y `REMOTE_ADDR` del contenedor Next, la
identidad del throttle es la IP del visitante.

## Verificación

- Backend `pytest tests/unit/fe_de_vida tests/integration/fe_de_vida tests/unit/core/test_throttles.py`:
  **261 passed**.
- Frontend: `npx tsc --noEmit` 0 errores; `npx eslint src --quiet` 0 errores;
  `npx vitest run verificar-constancia.test.ts` **8/8**.
- `lint-imports`: 91/0 · `makemigrations --check`: sin cambios.

## Para el documento de despliegue (nuevo)

- **`DJANGO_NUM_PROXIES`** (por defecto `1`): número de proxies de confianza
  delante de Django. `1` = Next; `2` = nginx + Next si nginx también proxya a
  Django. Debe coincidir con la cadena real o el throttling contará la IP
  equivocada.
- **nginx debe sobrescribir** `X-Forwarded-For` (no añadir) con
  `proxy_set_header X-Forwarded-For $remote_addr;`. Si solo la añade, un cliente
  puede falsificarla y saltarse el límite. Anotado en `NOCHE-DECISIONES.md`.

## Pendiente / fuera de alcance

- Otros renders de página que refresquen tokens (más allá de la verificación)
  siguen usando el refresco actual. El arreglo general (no refrescar nunca desde
  un Server Component) requiere revisar cada pantalla y se anota como deuda.
