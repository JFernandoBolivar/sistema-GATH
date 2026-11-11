# Decisiones de la noche (11/11/2026)

Todo lo que necesita decisión del usuario queda aquí, sin aplicar (regla 5 del
plan). Cada entrada: qué es, por qué necesita decisión, opciones y recomendación.

## No hacer esta noche (indicado por el plan)

| ID | Tema | Por qué no se aplica | Opciones / recomendación |
| -- | ---- | -------------------- | ------------------------ |
| F2-01 | Actualizar `next` 16.1.3 y `next-auth` beta | Cambio mayor de dependencias con 67 avisos; el plan pide rama aparte y aprobación | Rama dedicada `chore/next-upgrade`; actualizar y correr E2E; recomendado antes de exponer producción |
| S2-01 | Quién puede ver los datos de salud (`ver_salud`, `editar_*`, `pasivos.ver_detalle`, `familiares.eliminar`) | Es una decisión de permisos de roles, no un bug de código | Definir la matriz con RR. HH. y aplicarla en `seed_permisos`; recomendado: salud solo con `personal.ver_salud` explícito |
| I2-* | Cambios de `compose.yml` e infraestructura | El plan excluye tocar compose/despliegue | Aplicar en el servidor: `client_max_body_size`, volúmenes de logs, usuario no root, SeaweedFS con auth, TLS. Recomendado por prioridad (ver 00-CONSOLIDADO) |
| A2-36 | Partir archivos gigantes (`repo_carnetizacion_orm.py` 1292 líneas, `reglas_catalogos_views.py`, `catalogos_soporte_views.py`, `cuenta_views.py`) | Refactor estructural sin cambio funcional; riesgo alto en una noche | Pase aparte con pruebas de integración congeladas |
| A2-24..A2-28 | Cambios de esquema de BD | El plan los excluye; requieren migración y ventana | Diseñar y migrar con respaldo previo |

## Decisiones detectadas durante la noche

_(se irán agregando aquí a medida que avancen las tareas)_

- **F2-05 / S2-07 (T2)**: `NUM_PROXIES` nuevo en el documento de despliegue.
  No requiere decisión, pero sí que el nginx de producción **sobrescriba**
  `X-Forwarded-For` con `$remote_addr` (si solo lo añade, un cliente puede
  falsear la IP y saltarse el throttling). Recomendación: añadirlo al
  documento de despliegue; se documenta en `NOCHE-T2.md`.

- **Prettier (AUD3-02-03)**: `npx prettier --check "src/**/*.{ts,tsx}"` falla en
  **1192 archivos**. Hay configuración pero el árbol nunca se formateó. Un
  `prettier --write` global genera un diff enorme que choca con el trabajo en
  curso. Recomendación: un commit exclusivo `style: prettier` en una rama sin
  cambios funcionales, con `format:check` en CI después.

- **Dependencias (AUD3-01-02)**: `requirements.txt` mezcla herramientas de
  desarrollo (`pytest`, `pytest-django`, `ruff`, `mypy`, `import-linter`) con
  producción y deja sin fijar `psycopg2`, `argon2-cffi>=23.1`, `pytest>=8.0`,
  `pytest-django>=4.8`, `ruff>=0.6`, `import-linter>=2.0`, `mypy>=1.10`.
  Recomendación: `requirements-dev.txt` aparte y fijar todas las versiones en
  una rama con la batería completa (afecta el build).

- **A2-05 (AUD3-01)**: `apps/identidad/application` importa
  `rest_framework_simplejwt` en `cerrar_sesion`, `emitir_tokens_sesion` y
  `rotar_tokens_sesion`. Requiere puerto `EmisorTokens` + adaptador y añadir
  `rest_framework_simplejwt` a los prohibidos de `identidad`. Toca el login y el
  refresco: tarea dedicada con sus pruebas.

- **A2-06 (AUD3-01)**: `apps/cargos/domain/events.py` usa `django.dispatch.Signal`
  (excepción declarada en `.importlinter`). Moverla a infrastructure y exponer un
  puerto de publicación cambia la API interna de eventos de cargos; tarea
  dedicada.

- **A2-07 (AUD3-01)**: `transaction.atomic()` en 56 vistas (21 fe de vida, 19
  configuración, 11 autogestión, 4 pasivos, resto identidad). Recomendación:
  UnitOfWork por caso de uso; no se toca esta noche por riesgo.

- **Limpieza de arquitectura (AUD3-01-03/04/05)**: tres casos de uso de
  autogestión sin cablear (`consultar_censo.py`, `listar_preguntas.py`,
  `reporte_censo.py`: las vistas de censo usan el repositorio porque el JSON que
  consume el frontend no coincide con sus DTO), los adaptadores de
  `carga_masiva` fuera de `infrastructure/repositories/`, y la retención de
  `configuracion` que barre modelos de otras apps. Ninguno afecta el
  comportamiento; recomendación: tarea de limpieza con pruebas de censo y
  retención congeladas.

- **Frontera de importación del frontend (AUD3-02-01)**: `eslint.config.mjs` no
  tiene `import/no-restricted-paths` ni existe el test de invariantes, así que
  la frontera Onion no se vigila. Añadirla requiere `eslint-plugin-import` y
  declarar las zonas de los 19 módulos; tras las correcciones del PASO 2 el
  árbol ya cumple las dos reglas principales. Recomendación: tarea dedicada con
  el plugin y `pnpm lint` en CI.

- **Unificación de `src/components` y `src/shared/ui` (AUD3-02-02/03)**:
  conviven 76 archivos en `src/components` (612 imports) con 80 en
  `src/shared/ui/components` (677), y `src/lib` (10) con `src/shared/lib` (19).
  Además `src/app/types/types.ts` lo importan módulos. Es el `MED-10`/`F2.9` del
  plan del proyecto; unificar es masivo y sin cambio funcional: tarea aparte con
  la batería completa.

- **Acciones que lanzan en eventos (AUD3-02-08)**: `eventos-actions.ts` no
  devuelve `Resultado<T>` en sus escrituras (20 `throw`). Convertirlo exige sus
  pruebas de eventos; los `throw` de las acciones de lectura son intencionales
  para SWR.

- **Paginación de los listados (AUD3-03-05)**: la paginación global de DRF
  (`PageNumberPagination`, `PAGE_SIZE=10`) no actúa sobre las 327 vistas
  `APIView`; cada listado decide. `CensoConsultarView` sin cédula devuelve todos
  los censados con sus respuestas. Paginar cambia el contrato del frontend
  (`ok(lista)` → `ok({results, count, …})`). Propuesta: helper
  `paginar(queryset, request)` en `core/presentation/` y migrar por módulos,
  empezando por censos.

- **Cobertura del esquema OpenAPI (AUD3-03-12)**: `spectacular --validate`
  reporta 294 errores (71 vistas únicas) por vistas `APIView` sin `responses=`.
  No rompe el runtime ni el comando (exit 0), pero deja fuera del contrato a
  carga masiva, censo, autogestión, cargos y carnets. Anotarlas es una tarea de
  documentación sin cambio funcional.

- **Dependencias del frontend (AUD3-04-01, eleva F2-01 a bloqueante)**:
  `pnpm audit --prod` da 67 vulnerabilidades (7 críticas): RCE de Next 16.1.3 en
  Image Optimization (AVIF/SVG) y Windows, bypass de middleware/proxy, y
  `next-auth` con fallo abierto y bypass del `@` por homoglifos. Corregido en
  `next >= 16.4.1` y `next-auth` estable (`@auth/core >= 0.41.3`). Mitigantes
  actuales: SVG deshabilitado, sin `remotePatterns` y autorización real en
  Django. Requiere rama de upgrade con E2E completa.

- **Contraseña inicial del superadministrador (AUD3-04-02)**: el bootstrap crea
  `30799436` con contraseña igual a la cédula y cambio forzado a 7 días.
  Recomendación: `SUPERADMIN_PASSWORD_INICIAL` obligatoria y aleatoria en
  producción; abortar el bootstrap si no está.

- **Archivos de `MEDIA_ROOT` (AUD3-04-04)**: `media_views` sirve cualquier
  archivo a cualquier sesión (solo deniega `familiares/`). Recomendación: servir
  por clave opaca o comprobar el dueño; si queda vacío en producción, retirar el
  endpoint.

- **Documentación OpenAPI (AUD3-04-05)**: `/api/schema|docs|redoc` solo exigen
  sesión; cualquier cuenta ve el contrato. Recomendación: permiso administrativo
  o solo red interna/`DEBUG`.

- **Auditoría de dependencias del backend (AUD3-04-06)**: `pip-audit` no está
  instalado y las versiones no están fijadas. Recomendación: añadirlo al CI con
  la tarea de `requirements-dev.txt`.

- **Breakpoint del armazón móvil (AUD3-07-04)**: `use-mobile.ts` usa 1024 px y
  la skill del proyecto documenta 768. Moverlo cambia qué pantallas usan el
  cajón lateral; es una decisión de diseño.

- **Endurecimiento de contenedores (AUD3-08-06..10)**: el contenedor de Django
  corre como **root** (sin `USER`), no hay `read_only`/`cap_drop` ni límites de
  CPU/memoria en `django`, las imágenes usan etiquetas flotantes (`portainer`,
  `redis`, `rabbitmq`) y Django/Next publican puertos al host. El plan excluye
  tocar Docker/compose: aplicar en el servidor (usuario sin privilegios,
  límites, solo el proxy publicado, digest fijo).
