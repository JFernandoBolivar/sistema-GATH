# Reporte G1–G4 — Gestión de Trabajadores (2026-10-30)

Rama: `feature/fe-de-vida-pasivos`. Sin commit ni push (lo hace el agente principal).
Origen: `AUDITORIA_GESTION_TRABAJADORES_2026-10-29.md` → `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md` (bloque «Regresiones y pendientes de Gestión de Trabajadores»).

## Resumen

| ID | Hallazgo | Estado | Causa raíz verificada en vivo |
|---|---|---|---|
| G1 | Filtros de estructura del reporte de trabajador ocultos | Corregido | `tienePermiso(permisos, "*")`: ningún rol recibe `*` (el seed entrega códigos enumerados) |
| G2 | PDF no se genera / error invisible | Corregido | `AttributeError: 'OrganismoAdscritoModel' object has no attribute 'nombre'` en el repositorio → **500 en todas las variantes** del reporte; el componente además solo hacía `console.error` y `form.reset()` |
| G3 | Backend aplica ~11 de ~30 filtros, descarta `agrupar_por`/`tipo_reporte`, tope mudo de 500 | Corregido | Los filtros se ignoraban en el repositorio; `agrupar_por`/`tipo_reporte` se descartaban en `route.ts`; `qs[:500]` fijo |
| G4 | Sin entrada de menú a `/configuracion/visual` | Corregido | La pantalla existía pero ningún sidebar la enlazaba |

## G1 — Filtros de estructura organizativa

- `NextJS/src/modules/reportes/domain/value-objects/permisos-reportes.ts` (nuevo): códigos reales del seed
  (`reportes.ver`, `reportes.generar_pdf`, `reportes.generar_excel`, `reportes.estadisticas`) y
  `PERMISO_ESTRUCTURA_ORGANIZATIVA = "organizacion.ver"`.
- `NextJS/src/modules/reportes/application/use-cases/permisos-reporte.ts` (nuevo): predicados
  `puedeVerReportes`, `puedeGenerarReportePdf`, `puedeGenerarReporteExcel`,
  `puedeFiltrarEstructuraOrganizativa` (fail-closed, sin rol ni `*`).
- `report-employees.tsx`, `report-code.tsx`, `report-family.tsx`, `report-leaving.tsx`: el fieldset
  «Dirección Administrativa» se muestra con `organizacion.ver` (el permiso que exigen
  `dependencias/`, `direcciones-generales/`, `direcciones-linea/` y `coordinaciones/` del backend), no
  con el comodín. Se eliminó el patrón `role.nombre_rol === "ADMINISTRADOR"` / `"*"` de los cuatro.
- `reportes-page.tsx`: usa las mismas constantes (fuera de G1, mismo módulo).

Verificación: Playwright (ADMINISTRADOR ve los 4 filtros; ADMIN_BIENESTAR, sin `organizacion.ver`, no
los ve). Vitest `permisos-reporte.test.ts`.

## G2 — Generación del PDF y visibilidad del error

Backend (causa raíz del «no se genera»):

- `apps/reportes/infrastructure/repositories/repo_reportes_orm.py`: `OrganismoAdscritoid.nombre` →
  `Organismoadscrito` (mismo bug en el reporte de códigos) y `motivo_egreso.motivo` → `.movimiento`
  (rompía el reporte de pasivos). El reporte de personal devolvía **HTTP 500** en las tres variantes
  (JSON, PDF, Excel) antes de este cambio.
- El permiso ya era correcto: `ReportePersonalActivoPdfView` exige `HasPermission('reportes.generar_pdf')`
  (y `reportes.ver` el listado). Se verificó en vivo: con el token de un perfil sin el permiso, el
  endpoint responde **403**.

Frontend:

- `report-employees.tsx` / `report-code.tsx`: `onSubmit` ya no hace `console.error`; muestra el error con
  `toast.error` (componente compartido), **no limpia el formulario** si falla, guarda el PDF anterior sin
  fugas (`URL.revokeObjectURL`) y avisa del éxito. Si la sesión no tiene `reportes.generar_pdf`, el botón
  se desactiva y se explica el permiso requerido (y el backend lo vuelve a exigir).
- `app/api/reports/pdf/route.ts`: propaga estado y mensaje reales del backend (403/400/500) en
  `{ error }`, deja de descartar `agrupar_por`/`tipo_reporte` y propaga las cabeceras `X-Reporte-*`.
- `ui/services/reportes-catalogos.ts`: `postReport` devuelve `{ blob, total, limite, truncado }` y lanza
  el mensaje del backend; la URL del proxy pasa a `/api/reports/pdf` (evita el 308 por la barra final).
- `shared/infrastructure/http/errors.ts` + `fetcher-api.ts`: `ApiHttpError` (con `status`) y
  `apiClient.getBlobConRespuesta` para no perder las cabeceras de metadatos.

Verificación: Playwright (PDF 200 `application/pdf` + enlace `blob:`, error 403 visible conservando los
filtros, 403 del backend sin permiso).

## G3 — Todos los filtros, agrupación y tope configurable

- `apps/reportes/domain/entities/consulta_reporte.py` (nuevo): `ConsultaReportePersonal`
  (`lookups`, `tipo_reporte`, `agrupar_por`, `agrupar_por_ruta`).
- `apps/reportes/domain/services/filtros_reporte_personal.py` (nuevo): valida los filtros contra
  `ReportFieldRegistry` (única fuente del mapeo filtro → ORM, R-06) y traduce tipos:
  `edad_min/max` → fecha de nacimiento, `apn_min/max` → decimal, fechas ISO, rangos (`desde <= hasta`),
  intersección de `fecha_ingreso_*`/`fecha_apn_*` (comparten ruta en el registro). **Un filtro
  desconocido es un 400 explícito**, no un descarte.
- `apps/reportes/application/use_cases/generar_reportes.py`: `generar_reporte_personal(repo, filtros,
  registro, hoy)` (el caso de uso orquesta; la vista solo recolecta `query_params`).
- `repo_reportes_orm.py`: aplica los lookups con `distinct()` (una fila por empleado aunque tenga varias
  asignaciones), respeta `tipo_reporte=conteo` + `agrupar_por` (`values().annotate(Count)`), informa
  `total_encontrados`/`limite`/`truncado` y usa el setting **`REPORTES_MAX_FILAS`** (por defecto 5000;
  `0` = sin tope) en lugar del `qs[:500]` fijo.
- `GATH/settings.py`: `REPORTES_MAX_FILAS` configurable por entorno.
- `apps/reportes/presentation/views/reportes_views.py`: PDF y Excel añaden
  `X-Reporte-Total-Registros`, `X-Reporte-Limite` y `X-Reporte-Truncado`; sin lógica de negocio.
- `core/infrastructure/report_field_registry.py`: se añaden `estado_civil_id` y `tipo_personal_id`
  (claves que el frontend ya enviaba) sin cambiar las existentes.
- `NextJS/src/modules/reportes/ui/reportes-aviso-tope.ts` (nuevo): mensaje de tope; la UI lo muestra en
  un `role="status"` y con `toast.warning`.

Nota de alcance: en `tipo_reporte=lista` el documento se ordena por apellidos y nombres. Ordenar por una
relación multivaluada duplicaría filas por empleado; `agrupar_por` se aplica al `conteo` y viaja en los
metadatos del reporte.

El reporte es un **documento descargable**, no un listado en pantalla: la regla de paginación en servidor
(10 por defecto / tope 50) aplica a los listados, que no se modificaron aquí. Para el documento, el tope
es el `setting` y el aviso de truncamiento.

## G4 — Menú de Configuración visual (HU 0009)

- `NextJS/src/modules/personal/ui/components/app-sidebar-personal.tsx`: entrada «Configuración visual»
  → `/configuracion/visual` con `configuracion.editar` (el permiso del seed que ya usaba la pantalla).
- `NextJS/src/app/(app)/configuracion/layout.tsx` (nuevo): la pantalla conserva el shell y el sidebar de
  RRHH (antes se abría sin navegación).
- **No se tocó** el carnet ni la fe de vida: siguen sin usar el cintillo configurable (decisión del
  usuario 2026-10-29).

## Pruebas

Backend (código montado, comando del plan):

```
docker compose run --rm --no-deps -v "C:/.../BACKEND:/app/Django" \
  --entrypoint python django -m pytest -q -p no:cacheprovider
=> 928 passed  (línea base 869)
```

De esos 928, **39** son del módulo de reportes (antes eran 7): +32 propios.

- `tests/unit/reportes/test_filtros_reporte_personal.py` (15): los 30 filtros, edad/APN/fechas, rangos,
  filtro desconocido, `agrupar_por`/`tipo_reporte`.
- `tests/integration/reportes/test_reporte_personal_orm.py` (14): filtros reales contra PostgreSQL
  (sexo, estructura, nómina, cargo, grado, edad, APN, grupo sanguíneo, discapacidad, nivel académico,
  fecha de ingreso), tope configurable + `truncado`, sin tope con `0`, conteo agrupado y no duplicación
  con dos asignaciones.
- `tests/unit/reportes/test_reportes.py` (9): el caso de uso entrega los filtros ya traducidos y propaga
  metadatos.
- `tests/unit/reportes/test_reporte_personal_view.py` (1): la vista entrega los `query_params` como
  escalares (regresión del `dict(QueryDict)` que los convertía en listas).

Nota: la suite completa incluye además 27 pruebas nuevas del trabajo concurrente en `fe_de_vida` que se
está haciendo en este mismo árbol de trabajo; ninguna de ellas es de esta tarea y todas pasan.

Frontend:

```
npx vitest run   => 520 passed / 87 archivos (línea base 500; +10 propios)
npx eslint .     => 0 errors (104 warnings preexistentes)
npx tsc --noEmit => sin errores
```

- `permisos-reporte.test.ts` (6) y `reportes-aviso-tope.test.ts` (4). Los otros 10 tests del delta son
  del trabajo concurrente de `fe-de-vida`.

Contratos: `lint-imports` → **82 contratos, 0 rotos**.

## Verificación en vivo (Playwright)

`NextJS/e2e/reportes-trabajador.spec.ts` (nuevo): G1 (filtros visibles con `organizacion.ver` y ocultos
sin él), G2 (PDF 200 + descarga; error 403 visible sin perder filtros; 403 del backend sin permiso),
G3 (filtros aplicados, 400 de filtro desconocido, `conteo` agrupado, aviso del tope de filas) y G4
(menú → `/configuracion/visual`).

Reproducción previa a la corrección (mismas imágenes `docker compose build`, cuenta ADMINISTRADOR):
las pruebas se hicieron sobre imágenes reconstruidas
(`docker compose build django nextjs && docker compose up -d django celery_worker celery_beat nextjs`).

| Hallazgo | Antes | Después |
|---|---|---|
| G1 | `Dirección Administrativa` presente **0** veces en `/reportes/empleados` | fieldset visible con `organizacion.ver` |
| G2 | `POST /api/reports/pdf/` → **308** y luego **500** del backend (`AttributeError: 'OrganismoAdscritoModel' object has no attribute 'nombre'`); sin enlace «Descargar», sin aviso; al tener éxito se limpiaban los filtros | **200** `application/pdf` (~869 KB, 1022 filas) + enlace `blob:`; error visible y filtros intactos |
| G3 | filtros ignorados por el repositorio; `qs[:500]` fijo; el 500 ocultaba ambos defectos | `edad_min=999` → 0, `sexo_id=2` → 467, sin filtros → 1022; `conteo` por dirección general → 20 grupos; filtro desconocido → 400; cabeceras `X-Reporte-Total-Registros: 1022`, `X-Reporte-Limite: 5000`, `X-Reporte-Truncado: false` |
| G4 | el sidebar enlazaba 7 rutas, ninguna a `/configuracion/visual` | entrada «Configuración visual» → pantalla del cintillo con el shell |

Resultado: **9/9** pruebas E2E en verde (incluye la comprobación negativa con Bienestar y con el perfil
sin `reportes.generar_pdf`) y **15/15** del smoke de rutas (`e2e/smoke.spec.ts`) sin regresiones, sobre las
imágenes reconstruidas con el código final.

Nota de rendimiento (no es regresión de G1–G4): el PDF sin filtros de los 1022 trabajadores tarda ~24 s en
este entorno; el de un subconjunto (p. ej. `edad_min=70`, 77 filas) tarda ~6 s. Por eso el E2E de G2
acota con un filtro y espera hasta 120 s.

## Pendientes / observaciones

- **Los demás reportes del módulo conservan su tope fijo de 500 filas** (`pasivos`, `codigos`,
  `familiares`, `vacantes`): en vivo `codigos` y `familiares` devuelven exactamente 500. Es el mismo
  defecto que G3 pero fuera del alcance pedido; conviene aplicarlo con `REPORTES_MAX_FILAS` en una tarea
  aparte (los headers `X-Reporte-*` y el aviso de la UI ya existen y se reutilizarían).
- Aplicar configurable también a esos reportes requiere su equivalente en la UI (`report-family`,
  `report-leaving`), que hoy solo muestran el error.
- `Retroalimentación` en el sidebar sigue usando `configuracion.editar`; su permiso propio sería
  `catalogos.editar` (fuera del alcance de G4, se deja anotado).
- El reporte de movimientos (G6) mantiene su tope fijo de 300 filas y no exporta Excel: no se tocó.
- `/reportes` (pestañas, `reportes-page.tsx`) no está enrutado; la ruta activa es `/reportes/empleados`.
- La cuenta E2E `usuario.prueba.e2e@conatel.gob.ve` (cédula sintética 99999999, ADMINISTRADOR) tenía una
  contraseña distinta a la documentada en `PLAN_RECONSTRUCCION_UI_2026-09-15.md`; se restauró a la
  documentada para poder correr los E2E. No se tocó ninguna cuenta protegida ni su contraseña se copió a
  ningún archivo.
- En este árbol hay trabajo concurrente de otra tarea (`apps/fe_de_vida`, `src/modules/fe-de-vida`,
  `proxy.ts`, `constancia_pdf.py`): no se modificó nada de eso.
