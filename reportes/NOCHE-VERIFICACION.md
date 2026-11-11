# NOCHE — FASE 2: verificación y reconstrucción

**Fecha:** 2026-11-11 · **Sin commit**
**Alcance:** todo el árbol de trabajo (FASE 1 + correcciones de la auditoría 3).

## 1. Backend

| Comprobación | Comando | Resultado |
| ------------ | ------- | --------- |
| Pruebas completas | `pytest --create-db -q` (contenedor `gath-backend:latest`, BD `test_GATH-PRODUCT`) | **2190 passed, 1 skipped, 1 failed** en 32:19 |
| Prueba fallida | `tests/integration/core/test_arranque_frio.py::test_primera_peticion_de_un_interprete_nuevo_baja_de_un_segundo` | falló **solo** con el build de Docker en paralelo; aislada: **5 passed** en 1:48 |
| Suites de los módulos tocados tras el PASO 2/3 | `pytest tests/integration/carnetizacion/test_api_o45.py tests/unit/configuracion tests/unit/personal tests/integration/personal/test_reportes_error_views.py tests/integration/exportaciones --create-db` | **267 passed** en 1:02 |
| Contratos de arquitectura | `lint-imports` | **103 contratos, 0 rotos** |
| Migraciones | `manage.py makemigrations --check --dry-run` | **No changes detected** |
| Esquema OpenAPI | `manage.py spectacular --file /tmp/esquema.yml --validate` | exit 0; 469 avisos / 294 errores de «unable to guess serializer» en 71 vistas (AUD3-03-12) |
| Sintaxis | `python -m compileall apps core` | OK |

`test_arranque_frio` es sensible a la carga (mide el arranque de un intérprete
nuevo contra un umbral de 1 s). No es una regresión: pasa sola.

**Nota sobre la segunda corrida completa.** Se intentó repetir la batería
completa después de las correcciones del PASO 2 y 3, pero el `TRUNCATE` de
teardown de pytest se quedó varios minutos bloqueado por la E/S del equipo
(OneDrive/antivirus sobre el árbol montado) y la corrida no terminó en un tiempo
razonable; se detuvo. Las suites de todos los módulos backend tocados se
ejecutaron por separado con el resultado de arriba (**267 passed**), y el resto
del backend no cambió respecto de la corrida completa.

## 2. Frontend

| Comprobación | Comando | Resultado |
| ------------ | ------- | --------- |
| Tipos | `npx tsc --noEmit` | **0 errores** (repetido tras el PASO 2/3) |
| Lint | `npx eslint src --quiet` | **0 errores** (repetido tras el PASO 2/3) |
| Pruebas unitarias | `npx vitest run` | **210 archivos / 1118 pruebas passed** (11:26, repetido tras el PASO 2/3) |
| Build de producción | `npx next build` | **exit 0** (repetido tras el PASO 2/3) |

Prettier no se aplica: `prettier --check` falla en 1192 archivos y el formateo
global va a una decisión aparte (`NOCHE-DECISIONES.md`).

## 3. Reconstrucción local

1. `C:\gath_build` se refrescó con `git archive HEAD` + los archivos modificados
   y nuevos sin commit (excluyendo los `*.tmp.mjs` de otros agentes y las
   carpetas de muestras/auditoría), más `BACKEND/.env`, `NextJS/.env` y el
   `.env` raíz que usa `compose.yml`.
2. `construir.cmd`:
   - `docker compose -p gath build django` → `BACK_FIN`
   - `docker compose -p gath build nextjs` → `NEXT_FIN`
   - `TODO_FIN` en `build.log`
3. `docker compose -p gath up -d --no-build --force-recreate django celery_worker celery_beat nextjs`:
   contenedores `django-App`, `gath_celery_worker`, `gath_celery_beat` y
   `nextjs-App` **Up** (`bootstrap` termina y se retira). Compose devuelve
   `exit 1` al final por el contenedor de inicialización, pero los servicios
   quedan levantados; se comprobó con `docker compose ps`.

## 4. E2E (Playwright, `E2E_BASE_URL=http://localhost:3001`)

Especificaciones ejecutadas contra el sistema reconstruido:

| Spec | Qué cubre | Resultado |
| ---- | --------- | --------- |
| `e2e/auth-sesion.spec.ts` | login, cookies HttpOnly, aviso de inactividad, ojo de la contraseña | **4 passed** (en la corrida conjunta la prueba del reloj virtual pasó al reintento; aislada 4/4) |
| `e2e/fe-de-vida.spec.ts` | revisión de Bienestar (bandeja, filtros, foto, botones) y procesos/cobertura | **2 passed, 3 skipped** (una de ellas pasó al reintento por carga) |
| `e2e/auditoria/fe-de-vida-movil.spec.ts` | recorrido móvil completo: inicio, guía, captura, envío y QR (**T7**) | **2 passed** |
| `e2e/fe-de-vida-verificacion.spec.ts` | verificación pública de constancia (inexistente, mal formada y válida con `E2E_CONSTANCIA_CODIGO`) | **3 passed** |
| `e2e/carnetizacion.spec.ts` | consola de emisión, búsqueda por cédula, plantillas y estadísticas | **5 passed** aislada; en la corrida conjunta 1 falló por timeout de navegación bajo carga |
| `e2e/pasivos-fe-de-vida-reportes.spec.ts` | fe de vida y reportes dentro de pasivos, descarga del PDF (**T7**) | **3 passed** (el PDF pasó al reintento: el trabajo de Celery tardó más de 5 min con la cola cargada) |
| `e2e/auditoria/fix-fv1.spec.ts` | fe de vida **presencial** (búsqueda y formulario sin correo, PC y móvil) | **2 passed** |
| `e2e/accesibilidad.spec.ts` | axe-core en autogestión, Bienestar y Administración (0 `serious`/`critical`) | **9 passed** |

**Corrida conjunta (8 specs): 26 passed, 3 skipped, 3 flaky (pasaron al
reintento) y 1 failed**, este último por timeout de navegación (60 s) en
`/carnetizacion/estadisticas` con la cola de Celery y los reintentos en curso;
la spec de carnetizacion pasa **5/5** en aislamiento. El detalle y la
estabilización aplicada están en `AUD3-PASO7.md`.

### Causa de cada skip

- `fe-de-vida.spec.ts`: los tres recorridos del pasivo («archivo inválido»,
  «cámara falsa» y «subida de archivo») hacen `test.skip` cuando el pasivo de
  prueba ya tiene la solicitud **en revisión o validada**; es el estado en que
  la deja la spec móvil, que sí ejecuta el recorrido completo. El dato se
  puede reabrir desde Bienestar («Devolver para corrección»), pero no se
  modifica para forzar la prueba: el flujo en línea queda cubierto por
  `fe-de-vida-movil.spec.ts` y por la revisión de Bienestar.
- `fe-de-vida-verificacion.spec.ts`: la prueba de la constancia real exige
  `E2E_CONSTANCIA_CODIGO`. Se repitió con el código de una constancia VALIDADA
  de la base local (`FV-2026-000001`, lectura de solo lectura) y pasó: **3
  passed**.

### El único fallo intermitente y su corrección

En la corrida conjunta, `fe-de-vida.spec.ts:84` agotó los 120 s en
`page.goto("/autogestion/fe-de-vida")` esperando el evento `load`: la página
mantiene recursos largos (imágenes de la guía en SeaweedFS) y `load` no siempre
se dispara en local. Pasó al reintento. Se cambió el helper
`recorrerHastaLaFoto` a `waitUntil: "domcontentloaded"` (la spec ya espera los
elementos concretos), igual que en `carnetizacion.spec.ts` para
`/carnetizacion`. No se tocó la aplicación.

### Especificaciones actualizadas para la interfaz actual

Todas se ajustaron **sin cambiar la aplicación** (mismos textos y contratos):

| Spec | Antes | Ahora |
| ---- | ----- | ----- |
| `auditoria/fe-de-vida-movil.spec.ts` (**T7**) | «Guía paso a paso» | «Guía de Fe de vida» |
| `fe-de-vida.spec.ts` (**T7**) | botón «Ampliar» | botón «Ver completa» |
| `fe-de-vida.spec.ts` | encabezado «Datos propuestos por el pasivo» | sección «Datos personales» (el encabezado agrupador ya no existe) |
| `pasivos-fe-de-vida-reportes.spec.ts` (**T7**) | pestaña y botones «Excel»/«PDF» | título «Reporte De Pasivos» + «Consultar Reporte General» y descarga del PDF generado |
| `carnetizacion.spec.ts` | panel de bienvenida, «Buscar Personal», «Generar Carnet», formulario clásico de plantillas | Consola de Emisión única (O51): `/carnetizacion` redirige a `/carnetizacion/emision`, el buscador y los parámetros de emisión; plantillas por capas; textos actuales de estadísticas |

`carnetizacion.spec.ts` además escribía capturas en una ruta absoluta de otra
máquina (`/home/jbolivar@...`); se eliminaron esas capturas.

### Alcance de esta corrida

La corrida E2E se hizo contra la imagen reconstruida con las correcciones de los
pasos 1 a 7 (incluida la accesibilidad). Las pruebas de navegación usan
`domcontentloaded` y tiempos ampliados porque el árbol vive en OneDrive y la
primera petición tras reconstruir puede tardar; la estabilización está en
`AUD3-PASO7.md`. Las pruebas que fallaron en la corrida conjunta por ese motivo
pasan en aislamiento (carnetización 5/5, autenticación 4/4).
