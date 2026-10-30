# G11 — Resto de reportes: tope, orden, lotes y asignación vigente

Fecha: 2026-10-30 · Rama: `feature/fe-de-vida-pasivos` · Sin commit ni push.
Alcance: `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md` → G11 (códigos, familiares, egresos/pasivos,
vacantes), con las mismas reglas que el reporte de personal (G3, commit `9ccb5b8`).

## Qué se cambió

### Reglas compartidas en un solo lugar

`BACKEND/apps/reportes/infrastructure/repositories/consultas_reporte.py` (nuevo):

- `pagina_con_metadatos(qs, limite)` — materializa la página **una sola vez** y devuelve
  `total_encontrados`, `limite` y `truncado`. El tope ya no está en el código: es obligatorio.
- `en_lotes(valores)` + `TAMANO_DE_LOTE = 500` — trae los datos relacionados de la página en lotes
  acotados (sin N+1 ni listas gigantes en el SQL).
- `fechas_de_ingreso(antecedente_model, empleado_pks)` — `Max('fecha_ingreso')` por empleado en lotes
  (reingreso más reciente; la FK apunta a la **PK** de `Employee`).
- `elegir_asignaciones(asignaciones)` + `clave_de_asignacion` — una asignación por cédula
  (`AsigTrabajo.employee` apunta a la **cédula**): gana la **ACTIVA** (`EstatusModel.estatus = 'ACTIVO'`)
  y, si no hay, la **más reciente** por `fecha_actualizacion`; la PK desempata para que el resultado sea
  el mismo entre ejecuciones. Antes «la última del queryset ganaba» sin orden.

### Repositorio (`repo_reportes_orm.py`)

- **Códigos**: `order_by('codigo', 'pk')`, `limite` + metadatos, sin `[:500]`.
- **Vacantes**: `order_by('codigo', 'pk')`, `limite` + metadatos, sin `[:500]`.
- **Familiares**: `order_by(employeecedula__apellidos, employeecedula__nombres, employeecedula_id,
  primer_apellido, primer_nombre, pk)`, `limite` + metadatos.
- **Egresos/pasivos**: `order_by(employee__apellidos, employee__nombres, employee_id, pk)`, `limite` +
  metadatos; la fecha de ingreso es el **reingreso más reciente** (`Max`, sin el `order_by(...).first()`
  por fila); el snapshot de cargo se trae en un lote (`CargoEgresado`, la PK más reciente por egreso) y el
  respaldo usa la asignación vigente ya elegida. Se eliminaron las **tres consultas por fila** (N+1).
- **Personal**: usa `elegir_asignaciones` (antes la última del dict ganaba) y `fechas_de_ingreso`.

### Casos de uso, puerto y vistas

- `generar_reporte_pasivos/familiares/codigos(..., limite)` y `generar_reporte_vacantes(repo, limite, ...)`:
  `limite` obligatorio (sin valor por defecto) en la aplicación y en el puerto `RepoReportes`.
- Las 12 vistas de esos cuatro reportes pasan `limite_de_reporte(para_pdf=...)`
  (`REPORTES_MAX_FILAS_PDF` para PDF, `REPORTES_MAX_FILAS` para JSON/Excel) y las variantes PDF/Excel
  envían `X-Reporte-Total-Registros`, `X-Reporte-Limite` y `X-Reporte-Truncado` con `dto.metadatos`
  (antes esas cabeceras solo existían en el reporte de personal).

### Frontend

- `report-family.tsx` y `report-leaving.tsx` muestran el aviso de truncado (`role="status"` +
  `toast.warning`) reutilizando `reportes-aviso-tope.ts`, igual que `report-employees` y `report-code`.

## Pruebas

Backend (código montado):

```
docker compose run --rm --no-deps -v "C:/.../BACKEND:/app/Django" \
  --entrypoint python django -m pytest -q -p no:cacheprovider
=> 999 passed  (base 990; +9 propios)
```

- `tests/integration/reportes/test_reportes_resto_orm.py` (7): códigos truncado con datos completos y
  orden estable; vacantes ordenadas y truncadas; familiares truncados y con orden estable entre dos
  ejecuciones; egresos con dos antecedentes → reingreso más reciente; egresos sin snapshot → asignación
  vigente; egresos truncado y orden estable.
- `tests/integration/reportes/test_reporte_personal_orm.py` (+2): con una asignación activa y otra más
  reciente inactiva gana la **activa**; sin activa gana la **más reciente**.
- `tests/unit/reportes/test_reportes.py`: los casos de uso propagan el `limite` y los metadatos.

Frontend:

```
npx vitest run   => 550 passed / 91 archivos (base 549)
npx eslint .     => 0 errors (104 warnings preexistentes)
npx tsc --noEmit => sin errores
```

`lint-imports` → **82 contratos, 0 rotos**.

## Verificación en vivo (Playwright)

Imágenes reconstruidas y `e2e/reportes-trabajador.spec.ts` ampliado:

- Códigos, familiares y egresados: el aviso «tope de 5.000 filas» aparece al generar con truncado.
- Cada reporte (pasivos, cargos-vacantes, familiares, códigos) se genera en **PDF** y **Excel** con
  `X-Reporte-Truncado`, `X-Reporte-Limite` y `X-Reporte-Total-Registros`.
- Egresos responde con `metadatos.total_encontrados/truncado/limite`.

Resultado: **20/20** pruebas E2E en verde (15 previas + 5 de G11) sobre las imágenes reconstruidas con
`docker compose build django nextjs; if ($?) { docker compose up -d django celery_worker celery_beat nextjs }`.

Datos reales de la BD local (código montado, `limite=5`):

| Reporte | Antes | Ahora | Truncado |
|---|---|---|---|
| Códigos | `qs[:500]` (500 filas, sin aviso) | **1010** encontrados, 5 en la página | sí |
| Familiares | `qs[:500]` (500 filas, sin aviso) | **2538** encontrados, 5 en la página | sí |
| Egresos | `qs[:500]` + 3 consultas por fila | sin egresos en esta BD; el flujo se cubre con tests | no |
| Vacantes | `qs[:500]` | 1 cargo vacante | no |

Los dos empleados con dos antecedentes muestran su reingreso más reciente (01/09/2026 y 07/09/2024).

## Pendientes

- G9 (antigüedad APN oficial 30/360) y G10 (definición de «Fecha APN») siguen abiertos.
- `/auth/me/` sigue entregando los códigos del rol (deuda aparte, ya anotada en la ronda anterior).
- Los reportes de tendencias y distribución no paginan: son series agregadas de tamaño fijo (12 meses /
  tipos de nómina), no listados; no aplican tope.
