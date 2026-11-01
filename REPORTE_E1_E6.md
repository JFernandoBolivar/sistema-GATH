# Reporte E1–E6 — Seguridad y observabilidad

Fecha: 2026-11-01  
Rama: `feature/fe-de-vida-pasivos`  
Estado: **culminado** (E4 con un pendiente documentado: CSP con nonce en Next.js),
todo el trabajo **sin commit** por decisión del usuario.

---

## 1. E1 — Auditoría con hash encadenado

**Objetivo:** que la bitácora sea verificable e inmutable, con trazabilidad de
cliente y `trace_id`.

- `core/infrastructure/models/auditoria.py`
  - Nuevos campos: `dispositivo`, `hash_anterior`, `hash_actual`.
  - `save()` rechaza actualizaciones de filas existentes y calcula el hash al
    crear; `delete()` rechaza el borrado.
- `core/domain/auditoria.py`
  - `GENESIS_AUDITORIA = '0' * 64`.
  - `contenido_hash()` usa JSON canónico y excluye `fecha_hora` y los hashes.
  - `calcular_hash_registro()` encadena `hash_anterior + contenido`.
  - `dispositivo_de_user_agent()` clasifica MÓVIL/TABLET/ESCRITORIO/BOT.
- `core/presentation/audit.py`
  - `origen_de_peticion()` devuelve IP, `user_agent` y `dispositivo`.
- `core/management/commands/verificar_cadena_auditoria.py`
  - Recorre la cadena y falla con `CommandError` en el primer registro alterado.
- `core/migrations/0006_...`
  - Agrega columnas, encadena los registros existentes desde el génesis y crea
    el trigger PostgreSQL `gath_auditoria_append_only_trigger`
    (`BEFORE UPDATE OR DELETE`).
- **No se borró ningún registro.** En desarrollo se verificaron **204
  registros** con el comando y se comprobó que PostgreSQL bloquea `UPDATE` y
  `DELETE`.

---

## 2. E2 — Límites y archivos

- `core/presentation/throttles.py`: `UploadRateThrottle` y
  `ExportRateThrottle`, con tasas `upload`/`export` en settings.
- Scopes configurados: `login`, `password_reset`, `refresh`,
  `fe_de_vida_verificacion_publica`, `upload`, `export`.
- `RefreshView` usa `throttle_scope = 'refresh'`.
- `MAX_UPLOAD_SIZE` (10 MB por defecto) aplicado a
  `DATA_UPLOAD_MAX_MEMORY_SIZE` y `FILE_UPLOAD_MAX_MEMORY_SIZE`.
- `core/infrastructure/storage/antivirus.py`: adaptador ClamAV por `INSTREAM`,
  **apagado por defecto** (`ANTIVIRUS_HABILITADO=false`); si se activa y el
  antivirus no responde, rechaza el archivo (fallo cerrado).

---

## 3. E3 — Observabilidad del worker

- `core/presentation/trace_middleware.py`: acepta `X-Trace-Id`/`X-Request-ID`,
  genera uno si falta, lo guarda en `request.trace_id` y en el `ContextVar`, y
  lo devuelve en `X-Request-ID`.
- `core/infrastructure/logging/json_formatter.py`: una línea JSON por evento
  con timestamp, nivel, logger, mensaje, `trace_id` y campos extra.
- `core/infrastructure/logging/trace_context.py`: `ContextVar` compartido por
  HTTP y tareas.
- `core/infrastructure/tasks/celery_queue.py`: envía `headers={'trace_id': ...}`
  al broker.
- `core/infrastructure/tasks/celery_signals.py`: recupera el `trace_id` en
  `task_prerun`, lo limpia en `task_postrun` y emite líneas JSON en
  `task_failure`/`task_retry`.
- El worker **no** secuestra el logger raíz
  (`CELERY_WORKER_HIJACK_ROOT_LOGGER=False`): sus líneas salen en el mismo JSON
  y con el mismo `trace_id` que la API.
- `core/infrastructure/tasks/metricas_tasks.py`: tarea `core.metricas_cola`
  (beat cada 60 s) con profundidad de cola y tareas activas.
- Outbox:
  - `GET /api/v1/notificaciones/outbox/fallidos/` (permiso
    `notificaciones.administrar`) devuelve total y últimos 5 fallidos.
  - Aviso in-app en el layout de Administración → Configuración
    (`AvisoOutboxFallido`), visible solo si hay fallidos.

---

## 4. E4 — Cabeceras y pruebas de seguridad

- Django: `core/presentation/security_headers.py`
  - CSP `default-src 'none'`, `frame-ancestors 'none'`, `base-uri 'none'`,
    `form-action 'none'`, sin `unsafe-inline`.
  - `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
    `Permissions-Policy` (cámara/micrófono/geolocalización deshabilitados en la
    API), COOP y HSTS en producción.
- Next.js: `next.config.ts` con `nosniff`, `DENY`, `Referrer-Policy`,
  `Permissions-Policy` global (`camera=()`) y `camera=(self)` **solo** en
  `/personal/fe-de-vida/*` y `/autogestion/fe-de-vida/*`, COOP y HSTS en
  producción.
- Pruebas: `tests/integration/core/test_seguridad_cabeceras.py`
  - cabeceras presentes en respuestas API;
  - `CsrfViewMiddleware` activo;
  - cookies JWT `HttpOnly` y `SameSite=Lax`;
  - login fallido sin cookies de sesión;
  - endpoint de usuarios sin sesión no filtra `results`.
- La suite existente ya cubre IDOR/escalada en fe de vida, autogestión,
  auditoría, configuración y notificaciones.

**Pendiente documentado:** CSP con nonce en Next.js. Requiere volver dinámico
el render de páginas públicas y validar todos los flujos con credenciales de
Administración; se dejó fuera para no romper el arranque por scripts inline de
Next.

---

## 5. E5 — Retención y panel de Bienestar

### Parámetros nuevos (Administración → Configuración)

| Clave | Defecto | Mín. | Máx. |
|---|---|---|---|
| `retencion.evidencias_dias` | 365 | 30 | 3650 |
| `retencion.soportes_dias` | 365 | 30 | 3650 |
| `retencion.notificaciones_dias` | 180 | 30 | 3650 |
| `retencion.outbox_dias` | 90 | 30 | 3650 |

- Backend: `core/domain/configuracion.py` y
  `apps/configuracion/domain/parametros.py` (grupo `retencion`).
- Frontend: grupo «Retención de datos» en la pantalla de parámetros.

### Tarea beat `configuracion.purgar_retencion`

- Diaria a las 03:00.
- Purga:
  - evidencias de fe de vida (archivo S3 + punteros, conserva hash/metadatos);
  - soportes documentales de autogestión (archivo + fila);
  - notificaciones **leídas**;
  - correo saliente ENVIADO/FALLIDO y sus adjuntos. Los PENDIENTES no se tocan.
- **Nunca** purga `AuditoriaLog` ni `ConstanciaFeDeVidaModel`.
- Cada ejecución deja un `AuditoriaLog` con acción
  `configuracion.retencion_aplicada` y los conteos.
- Si el almacenamiento falla, omite el elemento y registra el aviso; no deja
  punteros huérfanos.

### Panel de Bienestar

- La bandeja de solicitudes muestra indicadores de total, pendientes, en
  revisión, aprobadas y rechazadas.
- Se calculan en el backend (`resumen_bandeja`) y se agregan a la respuesta
  existente; no cambian filtros, paginación ni diseño.

---

## 6. E6 — Documentación

- `ESTADO_SISTEMA_2026-10-27.md`: sección 6 con el estado real de R-5/R-A y
  E1–E6, cifras y pendientes.
- `BITACORA_RECONSTRUCCION.md`: Entrada #042 con contexto, cambios y cifras.
- `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md`: filas E1–E6 marcadas
  como culminadas con nota y fecha.
- Este reporte.

---

## 7. Verificación

| Verificación | Resultado |
|---|---|
| Backend `pytest` completo | **1160 passed, 1 skipped** |
| `lint-imports` | **82 kept / 0 broken** |
| `makemigrations --check --dry-run` | Sin cambios |
| `manage.py check` | Sin issues |
| Vitest | **579 passed (98 archivos)** |
| `tsc --noEmit` | Sin errores |
| `eslint .` | 0 errores (78 avisos preexistentes) |
| `next build` | Correcto |
| Migración `core/0006` en desarrollo | Aplicada |
| `verificar_cadena_auditoria` | 204 registros, cadena válida |
| Trigger append-only (UPDATE/DELETE) | Bloqueado por PostgreSQL |
| Worker Celery | Tareas registradas; logs JSON con `trace_id` |
| Cabeceras Next en vivo (`/login`) | `nosniff`, `DENY`, referrer, permissions, COOP, HSTS |
| Cabeceras Django en vivo (API) | CSP estricta, `nosniff`, `DENY`, referrer, permissions, `X-Request-ID` |
| E2E responsive + axe (R-5/R-A) | 5/5 |
| E2E PWA (R-5/R-A) | 2/2 |

Comandos usados (PowerShell, Docker):

```powershell
$env:MSYS_NO_PATHCONV=1
docker compose run --rm --no-deps -v "C:/Users/josef/OneDrive/Documentos/trabajo/GATH/BACKEND:/app/Django" --entrypoint python django -m pytest -q -p no:cacheprovider
docker compose run --rm --no-deps -v "C:/Users/josef/OneDrive/Documentos/trabajo/GATH/BACKEND:/app/Django" --entrypoint lint-imports django
docker compose run --rm --no-deps -v "C:/Users/josef/OneDrive/Documentos/trabajo/GATH/BACKEND:/app/Django" --entrypoint python django manage.py makemigrations --check --dry-run
```

---

## 8. Pendientes reales

1. `E2E_ADMIN_PASSWORD` sigue siendo el marcador `COMPLETAR`: no se pudieron
   ejecutar capturas/axe en Administración ni Carnetización.
2. Validación en hardware real iOS/Android (teclado, safe-area, standalone).
3. CSP con nonce en Next.js.
4. HTTPS/HSTS efectivo de producción (Infraestructura, C0).
5. Pendientes funcionales previos ajenos a este bloque: filtros de `/personal`,
   validación de contrato en edición manual y registros legados con foto
   inválida.

No se hizo commit, push ni se tocaron cuentas o datos reales.
