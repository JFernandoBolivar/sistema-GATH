# Reporte G6, G7 y G8 — 2026-10-30

Alcance: filas **G6**, **G7** y **G8** de `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md`.
Sin commit ni push (árbol de trabajo con los cambios sin confirmar).

---

## G6 — Reporte de movimientos (HU 0008)

### Qué se hizo

| Requisito | Implementación |
|---|---|
| RN-008-01 también en el backend | `apps/movimientos/domain/value_objects/filtros_historial.py`: `FiltrosHistorial.desde_parametros()` normaliza y lanza `ValidationError` (→ **400**) si la fecha de inicio es posterior a la de fin. Se aplica al listado JSON, al PDF y al Excel. |
| PDF imprime los filtros aplicados | `FiltrosHistorial.como_etiquetas()` devuelve pares (etiqueta legible, valor) —nunca IDs— y `construir_pdf_historial_movimientos()` los imprime al inicio, con el aviso de truncado cuando aplica. |
| Exportar a Excel | Nueva vista `HistorialMovimientosExcelView` → `GET /api/v1/movimientos/excel/` con **los mismos filtros** que el PDF y permiso `movimientos.exportar_excel`. |
| Quitar el tope silencioso de 300 | El listado se pagina **en el servidor**: `Paginacion` (10 por defecto, máximo 50) y el repositorio devuelve página + total. Orden determinista `-fecha_movimiento, -pk` y datos relacionados con `select_related` (sin N+1). |
| PDF/Excel con tope configurable y aviso | `limite_de_reporte()` movido a `core/infrastructure/reportes.py` (compartido con reportes): PDF usa `REPORTES_MAX_FILAS_PDF` (5000) y Excel `REPORTES_MAX_FILAS`. El truncado viaja en `X-Reporte-Total-Registros`, `X-Reporte-Limite` y `X-Reporte-Truncado` (`core/presentation/descargas.py`), y la UI lo muestra con `role="status"` + `toast.warning`. |
| Pantalla con paginación y filtros | `movimientos-page.tsx`: total, página actual/total, botones Anterior/Siguiente, búsqueda local de la página, botones PDF y Excel; la descarga pasa por `/api/movimientos/{pdf\|excel}` (mismo origen, conserva la sesión y expone las cabeceras al navegador). |

### Archivos

**Backend — nuevos**
- `BACKEND/apps/movimientos/domain/value_objects/filtros_historial.py`
- `BACKEND/apps/movimientos/domain/value_objects/paginacion.py`
- `BACKEND/apps/movimientos/domain/value_objects/permisos_movimientos.py`
- `BACKEND/core/infrastructure/reportes.py`
- `BACKEND/core/presentation/descargas.py`

**Backend — modificados**
- `apps/movimientos/application/dtos/movimientos_dtos.py` (`PaginaMovimientosDTO`, `DocumentoMovimientosDTO`)
- `apps/movimientos/application/use_cases/listar_historial.py` (`consultar_historial`, `exportar_historial`)
- `apps/movimientos/domain/ports/repo_movimientos.py`
- `apps/movimientos/infrastructure/repositories/repo_movimientos_orm.py`
- `apps/movimientos/infrastructure/pdf_movimientos.py`
- `apps/movimientos/presentation/views/movimientos_views.py` y `urls.py`
- `apps/reportes/presentation/views/reportes_views.py` (usa el helper compartido)
- `apps/identidad/management/commands/seed_permisos.py` (permiso `movimientos.exportar_excel`)
- `apps/reportes/infrastructure/limites_reporte.py` **eliminado** (movido a `core`)

**Frontend — nuevos**
- `NextJS/src/app/api/movimientos/[formato]/route.ts` (+ `route.test.ts`)
- `NextJS/src/modules/movimientos/infrastructure/http/movimientos-descargas-api.ts` (+ test)
- `NextJS/src/modules/movimientos/ui/services/descargas-movimientos.ts`
- `NextJS/src/modules/movimientos/domain/value-objects/resultado-historial.ts`
- `NextJS/src/shared/lib/encabezados-reporte.ts`
- `NextJS/src/shared/lib/aviso-tope.ts` (+ test, movido desde `modules/reportes/ui/`)

**Frontend — modificados**
- `modules/movimientos/{application,domain,infrastructure,ui}` (DTOs, puerto, caso de uso, repo, HTTP, acciones, página)
- `modules/reportes/ui/{components,services}` (importan los helpers compartidos)
- `modules/notificaciones/ui/tipos-notificacion.ts` (tipos de movimiento, ver G8)

### Pruebas

- **Backend focalizado**: `tests/unit/movimientos` + `tests/integration/movimientos` → **34 passed**.
  - `tests/integration/movimientos/test_historial_orm.py`: orden determinista, paginación, RN-008-01, filtros, truncado, PDF con filtros y avisos del evento.
  - `tests/unit/movimientos/test_movimientos_reporte.py`: 18 pruebas de value objects, exportación y notificaciones.
- **E2E en vivo** `e2e/movimientos-reporte.spec.ts`: **6/6**
  1. paginación en servidor y tope de página 50;
  2. filtros + total + Anterior/Siguiente;
  3. RN-008-01 devuelve 400;
  4. PDF descargado con cabeceras `X-Reporte-*`;
  5. Excel descargado con los mismos filtros;
  6. aviso de truncado visible en la UI.
- En vivo se comprobó que el PDF y el Excel responden `200`, con `X-Reporte-Truncado=false` (la BD local no llega a 5000 movimientos) y `X-Reporte-Limite=5000`.

---

## G7 — Eliminar el código legado de `src/app/(protected)/dashboard`

### Borrado (9 archivos)
- `(protected)/dashboard/layout.tsx`
- `(protected)/dashboard/page.tsx` (selector de módulos)
- `(protected)/dashboard/gestion-pasivos/personal-jubilado/registrar/{page.tsx,forms/form-multi-steps.tsx,schemas/schemaRac.ts,actions/formStepActions.ts,actions/registerEmployeesActions.ts}`
- `(protected)/dashboard/gestion-trabajadores/api/getInfoRac.ts`
- `(protected)/dashboard/gestion-trabajadores/components/loading/loading.tsx`

### Borrado por quedar sin consumidores
- `NextJS/src/shared/forms/employees/**` (16 formularios de alta/edición que solo usaba el registro legado).
- `NextJS/src/shared/hooks/useEmployeeSearch.ts`.

### Migrado
- `(auth)/censo-vivienda/page.tsx` usaba `getInfoRac` (`getEmployeeInfo`/`getEmployeeById`). Ahora usa `getEmpleadoPorCedulaAction` del módulo `personal`, con el hook nuevo `modules/personal/ui/hooks/use-busqueda-empleado.ts`. Se conserva lo que la página necesita: nombres, cédula, estado civil, dirección, contratos (ingreso y política), años APN, teléfonos y dependencia/dirección general de la asignación.
- `/dashboard` se conserva como **redirección** a `/inicio` en `src/proxy.ts` (enlaces y marcadores antiguos); login y sidebars apuntan ya a `/inicio`. Los E2E de sesión se actualizaron a `/inicio`.

### Pruebas
- `e2e/rutas-legado.spec.ts` (**3/3** en vivo): `/dashboard` → `/inicio`, censo de vivienda con búsqueda real de un trabajador, y `/personal` + `/movimientos` abren.
- `e2e/auth-sesion.spec.ts`: **4/4** en vivo (se añadió espera de hidratación antes de adelantar el reloj virtual; el temporizador de inactividad se monta en el layout raíz).
- `tsc --noEmit`, `eslint` (0 errores) y `next build` en verde.

---

## G8 — Notificaciones de movimientos de personal

### Comportamiento
- Dominio puro `apps/movimientos/domain/services/notificaciones_movimiento.py`:
  - **RRHH/Bienestar** (bandeja `personal`, por permiso `personal.recibir_avisos_movimientos`): INGRESO, TRASLADO, CAMBIO DE ESTATUS, EGRESO y ALTA DE SOBREVIVIENTE.
  - **Trabajador** (bandeja `autogestion`, por cédula): INGRESO, TRASLADO y CAMBIO DE ESTATUS. **Nunca** en egreso (cuenta desactivada) ni en alta de sobreviviente (todavía no tiene cuenta).
  - El alta de sobreviviente se distingue porque el evento llega como `INGRESO` desde `RepoSobrevivientesORM` (emisor del evento existente).
- Idempotencia: `ref_tipo='movimiento'`, `ref_id = clave = id del movimiento`; reprocesar el evento no duplica avisos.
- Emisión en `transaction.on_commit` desde el receiver de `cargo_movimiento_ejecutado` (módulos desacoplados por señal). Un fallo al notificar se registra y **no** revierte el movimiento.
- Correo detrás de `NOTIFICAR_MOVIMIENTOS_POR_CORREO` (por defecto `False`, mismo patrón que `NOTIFICAR_BIENESTAR_POR_CORREO`).
- Permiso nuevo `personal.recibir_avisos_movimientos` en el seed: roles **1 (ADMINISTRADOR)**, **2 (ANALISTA)** y **5 (BIENESTAR SOCIAL)**; no se asigna al recepcionista.
- El **punto de cuenta** se genera en el mismo traslado (evento `cargo_dependencia_cambiada`) y queda cubierto por el aviso de traslado; no se emite un tipo separado.

### Archivos
- Nuevos: `apps/movimientos/domain/services/notificaciones_movimiento.py`, `apps/movimientos/domain/value_objects/permisos_movimientos.py`, `tests/unit/movimientos/test_movimientos_reporte.py`, `tests/integration/movimientos/test_historial_orm.py`.
- Modificados: `apps/movimientos/infrastructure/receivers.py`, `apps/identidad/management/commands/seed_permisos.py`, `BACKEND/GATH/settings.py`, `NextJS/src/modules/notificaciones/ui/tipos-notificacion.ts` (tipos `movimiento.ingreso`, `movimiento.traslado`, `movimiento.cambio_estatus`, `movimiento.egreso`, `movimiento.sobreviviente`).

### Verificación en vivo (solo cargo 109050 / empleado 3333333)
1. El cargo 109050 (código `16000008`, empleado E2E 3333333) tenía `Tipo_personal = NULL`, dato que la tabla física de historial exige; se completó temporalmente con `Tipo_personal=2 (ACTIVO)`.
2. Desde la UI `/movimientos/cambiar-estatus` se cambió el estatus a **SUSPENDIDO** (motivo «SUSPENDIDO POR ABANDONO DE CARGO»).
3. En `/personal/notificaciones` (cuenta con el permiso) apareció el aviso **«Cambio de estatus registrado»**, con el detalle del cargo, código, dependencia, gerencia, motivo y fecha.
4. Se restauró el estatus a **ACTIVO** por la misma pantalla.
5. Comprobación en BD: se crearon los movimientos **7423** (SUSPENDIDO) y **7424** (ACTIVO) y **36** notificaciones (2 movimientos × 18 destinatarios con el permiso; incluye la bandeja `autogestion` del trabajador 3333333).

### Datos de prueba restaurados
- Cargo 109050: `estatus_id` **1 (ACTIVO)** y `Tipo_personal_id` **NULL**, como estaban.
- Movimientos 7423 y 7424: **eliminados**; el empleado 11908 (C.I. 3333333) quedó con **0** movimientos, como antes.
- Notificaciones de esos dos movimientos: **36 eliminadas**; la cuenta administradora volvió a **7** notificaciones y se invalidó la caché de conteo de las 18 cédulas afectadas.
- El seed creó 2 permisos y **invalidó 17 sesiones** (comportamiento previsto del comando al cambiar la matriz).

---

## Suites completas

| Verificación | Resultado |
|---|---|
| Backend (`pytest -q`, BD real de pruebas) | **1028 passed** en 20:21 (base 1000; +28 nuevos) |
| `lint-imports` | **82 contracts kept, 0 broken** |
| Vitest | **94 archivos / 560 pruebas** |
| `tsc --noEmit` | sin errores |
| `eslint .` | **0 errores** (81 avisos preexistentes) |
| `next build` | compila y genera todas las rutas |
| E2E movimientos (G6) | 6/6 |
| E2E rutas legado (G7) | 3/3 |
| E2E sesión | 4/4 |
| E2E reportes (regresión) | 16 passed, 4 skipped (faltan cuentas opcionales de Bienestar/deny/trabajador en el entorno) |

## Observaciones
- No se tocaron `apps/fe_de_vida` ni `src/modules/fe-de-vida`, ni las cuentas E2E protegidas (solo se usó `usuario.prueba.e2e` para iniciar sesión y ejecutar el movimiento de prueba sobre el cargo indicado).
- Los E2E en vivo se ejecutaron contra `http://localhost:3001` (el `AUTH_URL` del compose); con `127.0.0.1` las redirecciones del proxy conservan el host configurado y el navegador pierde la cookie de sesión (comportamiento previo, ajeno a G6–G8).
- El historial de movimientos es append-only por diseño; los dos registros de la prueba se eliminaron para dejar la BD como estaba y se documentan aquí.
