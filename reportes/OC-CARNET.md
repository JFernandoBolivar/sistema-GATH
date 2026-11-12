# OC — Carnetización: «Mi carnet» real y motivo de reemisión (12/11/2026)

**Rama:** `feature/fe-de-vida-pasivos` · **Sin commit** (lo hace el coordinador).
**Reglas respetadas:** no se ejecutó pytest; sí `tsc`, `eslint`, `vitest` y
`lint-imports`. Se integró el trabajo sin commit de otro agente en
`apps/carnetizacion` (campos personalizados con origen, check-in de eventos y
formas del PDF): no se revirtió ni se reescribió; los cambios de esta tarea son
aditivos sobre esos archivos.

---

## T1. «Mi carnet» muestra el carnet real

### Backend

**Endpoint nuevo:** `GET /api/v1/autogestion/mi-carnet/vista-previa/`

| Archivo | Cambio |
| ------- | ------ |
| `apps/autogestion/presentation/views/autogestion_views.py` | `MiCarnetVistaPreviaView`: PNG del carnet vigente; `IsAuthenticated` (igual que `MiCarnetPdfView`); responde `image/png` con `Cache-Control: private, no-store` y `X-Content-Type-Options: nosniff`. Sin cédula en la sesión → 404. |
| `apps/autogestion/presentation/urls.py` | Ruta `mi-carnet/vista-previa/`. |
| `apps/autogestion/application/use_cases/obtener_mi_expediente.py` | `obtener_mi_carnet_vista_previa`: **Zero-IDOR** (solo la cédula del usuario), valida la política `puede_ver_carnet`, exige carnet activo y decodifica el `data:image/png;base64,...` que ya produce carnetización. |
| `apps/autogestion/domain/ports/repo_portal_trabajador.py` | Puerto `generar_vista_previa_carnet_activo`. |
| `apps/autogestion/infrastructure/repositories/repo_portal_trabajador_orm.py` | Implementación: reutiliza `RepoCarnetizacionORM().generar_vista_previa(cedula)` (rasteriza el PDF a 110 dpi); `None` si no hay carnet activo. |

No se duplicó la rasterización: la vista previa de carnetización sigue siendo la
única fuente. Si no hay carnet vigente, el `NotFoundError` se traduce a **404**
con el mensaje en español «No posee carnet activo emitido.» (sobre C-1).

### Frontend

| Archivo | Cambio |
| ------- | ------ |
| `src/modules/autogestion/ui/components/carnet-real.tsx` | **Nuevo**: pide el PNG al endpoint del mismo origen y sustituye el dibujo a mano. Estados: **«Cargando…»**, imagen real, **sin carnet (404)** con el aviso, y **error** con mensaje claro. |
| `src/modules/autogestion/ui/mi-carnet-view.tsx` | Usa `CarnetReal` en lugar de `CarnetVistaPrevia`; se elimina el carnet fijo y sus datos derivados. Se mantiene el botón **Descargar Carnet PDF**. |

### Pruebas

- `src/modules/autogestion/ui/components/carnet-real.test.tsx` (4): carga y
  muestra la imagen (`blob:`), 404 con aviso, 500 con error, fallo de red.
- `BACKEND/tests/unit/autogestion/test_mi_expediente.py`: se amplió el doble del
  puerto y se agregaron 5 pruebas — decodificación del PNG, 404 sin carnet,
  `PermissionDeniedError` si el módulo no está habilitado, vista 200
  `image/png` usando `request.user.cedula_id` (Zero-IDOR) y 404 sin cédula.

---

## T2. Motivo obligatorio para reemitir el carnet

### ¿Había campo de motivo?

`CarnetEmitido` ya tiene `motivo` (FK a `MotivosEmision`, usado por las
estadísticas `por_motivo`) y `observaciones`. **No se creó ninguna migración.**
El catálogo real tiene: `PRIMERA EMISIÓN`, `RENOVACIÓN`, `PÉRDIDA`, `DAÑO`,
`ACTUALIZACIÓN` (verificado en la BD local, solo lectura).

La correspondencia aplicada al reemitir es:

| `motivo_reemision` | Fila del catálogo |
| ------------------ | ----------------- |
| `PERDIDA_ROBO` | PÉRDIDA |
| `DETERIORO` | DAÑO |
| `CAMBIO_DATOS` | ACTUALIZACIÓN |
| `CAMBIO_CARGO` | ACTUALIZACIÓN |
| `OTRO` | el `motivo_id` que envíe la consola |

El enumerado exacto (y el detalle de «OTRO») se conserva en la auditoría y se
antepone a `observaciones` (`Reemisión: PERDIDA_ROBO | <observaciones>`), de modo
que también queda visible en el historial del carnet sin tocar el esquema.

### Backend

| Archivo | Cambio |
| ------- | ------ |
| `apps/carnetizacion/domain/services/motivo_reemision.py` | **Nuevo**: enum, validación pura (`OTRO` con detalle ≥ 10) y mapa al catálogo. |
| `apps/carnetizacion/domain/exceptions.py` | **Nuevo**: `ReemisionSinMotivoError` (subclase de `ConflictError`) con el resumen del carnet vigente. |
| `apps/carnetizacion/application/use_cases/emitir_carnet.py` | Si hay carnet vigente y no hay motivo → `ReemisionSinMotivoError` con la fecha `dd/mm/aaaa`; si hay motivo, resuelve el `motivo` del catálogo, compone `observaciones` y devuelve `EmisionCarnet(carnet, pdf, motivo_reemision, detalle)`. |
| `apps/carnetizacion/domain/ports/repo_carnetizacion.py` + `.../repositories/repo_carnetizacion_orm.py` | `obtener_carnet_vigente`, `motivo_id_para_reemision`; `buscar_personal` ahora devuelve `carnet_activo_emitido_en` (ISO) para el aviso de la consola. |
| `apps/carnetizacion/presentation/views/carnetizacion_views.py` | `CarnetGenerarView`: recibe `motivo_reemision` y `detalle`; en el conflicto responde **409** con `data.carnet_vigente` (`emitido_en`, `numero`, `id`) y el mensaje «Ya tiene un carnet vigente emitido el dd/mm/aaaa. Indique el motivo de la reemisión.»; al reemitir registra `carnetizacion.carnet_reemitido` en `registrar_auditoria` (actor, motivo, detalle, carnet nuevo, IP/UA). |

### Frontend

| Archivo | Cambio |
| ------- | ------ |
| `src/modules/carnetizacion/ui/views/consola-emision-view.tsx` | Al seleccionar a alguien con carnet vigente muestra el aviso con la fecha real, el selector **Motivo de la reemisión** (Pérdida o robo, Deterioro, Cambio de datos, Cambio de cargo, Otro) y, con «Otro», el detalle (mínimo 10). El botón **Emitir y Descargar PDF** queda deshabilitado hasta completarlo; el 409 se muestra como aviso. |
| `src/modules/carnetizacion/infrastructure/actions/carnetizacion-actions.ts` | `generarCarnetPdfAction` acepta `motivoReemision`, `detalle` y `observaciones`, y devuelve `status` + el mensaje del backend en los errores (antes lo genérico). |
| `src/modules/carnetizacion/infrastructure/http/carnetizacion-api.ts` | Envía `motivo_reemision`, `detalle` y `observaciones` en el `POST /generar/`. |
| `src/modules/carnetizacion/domain/entities/carnet.ts` | `EmployeeCarnet.carnet_activo_emitido_en`. |
| `src/modules/carnetizacion/ui/views/solicitudes-carnet-view.tsx` | Si la emisión falla (por ejemplo 409), **no** marca la solicitud como aprobada: muestra el mensaje y se detiene. |

Las otras pantallas que emiten (`emitir-carnet-view`) ya mostraban el mensaje de
error de la acción; ahora reciben el mensaje real del backend.

### Pruebas

- `BACKEND/tests/unit/carnetizacion/test_motivo_reemision.py` (7): validación del
  enum y del detalle, emisión sin carnet vigente, 409 con fecha y resumen,
  mapeo al catálogo, observaciones con el motivo y el detalle.
- `BACKEND/tests/integration/carnetizacion/test_api_o45.py` (4 nuevas y 2
  existentes ajustadas): sin carnet vigente emite sin motivo; con carnet
  vigente y sin motivo → 409 con `data.carnet_vigente`; con motivo → 200 y
  `AuditoriaLog` con `carnetizacion.carnet_reemitido`; motivo inválido y detalle
  corto → 400.
- `src/modules/carnetizacion/ui/views/consola-y-solicitudes.test.tsx` (3
  nuevas): aviso con la fecha y botón bloqueado hasta elegir motivo; «Otro»
  exige 10 caracteres; el 409 del backend se muestra como aviso. Se añadió el
  stub de `scrollIntoView` que Radix Select necesita en jsdom.

---

## Resultados

| Comprobación | Resultado |
| ------------ | --------- |
| `npx tsc --noEmit` | sin errores |
| `npx eslint src --quiet` | sin errores |
| `npx vitest run src/modules/carnetizacion src/modules/autogestion` | **52 archivos, 308 pruebas passed** |
| `lint-imports` | **103 contratos, 0 rotos** |
| pytest | **no ejecutado** (lo corre el coordinador) |

## Notas

- **Sin migraciones**: se usó el `motivo` FK existente de `CarnetEmitido`; el
  enumerado exacto y el detalle viven en la auditoría y en `observaciones`.
- El endpoint de vista previa es de solo lectura y **Zero-IDOR**: ignora
  cualquier cédula de la petición.
- El carnet dibujado a mano (`CarnetVistaPrevia`) sigue existiendo para el
  diseñador; «Mi carnet» ya no lo usa.
- El aviso de la consola usa la fecha ISO que ahora entrega `buscar_personal`;
  si la emisión se hace por otra vía y el backend responde 409, se muestra su
  mensaje con la fecha.
