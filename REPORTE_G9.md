# Reporte G9 — Antigüedad APN oficial

Fecha: 2026-11-01. Rama `feature/fe-de-vida-pasivos`. Sin commit ni push.

Alcance: fila **G9** de `PLAN_PRIORIDAD_AUTOGESTION_FE_DE_VIDA_2026-10-29.md`.
No se modificaron, revirtieron ni commiteareon los cambios previos de
D3/D4/D7/D8 ni sus correcciones de seguridad.

## Enfoque elegido

Se replicó en SQL la función oficial de Python
`calcular_total_apn` / `calcular_tiempo_comercial`, sin usar la columna legada
`Employee.total_anos_apn`:

1. **Antecedentes:** solo los que tienen `fecha_ingreso` y `fecha_egreso`
   (los abiertos se ignoran, como en Python).
2. **Días comerciales por antecedente:**

   ```
   (año_egreso - año_ingreso) * 360
   + (mes_egreso - mes_ingreso) * 30
   + (día_egreso - día_ingreso) + 1
   ```

   El `+1` es el día de inicio que incluye el método. **No** se aplica *clamp*
   del 31: `calcular_tiempo_comercial` no lo hace; añadirlo habría roto la
   paridad. Febrero y años bisiestos se tratan con la misma resta de fechas
   reales.
3. **Suma** con `Subquery`/`Sum` por empleado.
4. **Conversión a años fraccionarios** idéntica a la oficial:
   `años + meses/12 + días/365`, redondeada a 4 decimales. La regla vive en
   `tiempo_servicio.anios_fraccionarios()` y la usan tanto el mapper de Python
   como (por paridad probada) la expresión SQL.
5. **Filtros** `apn_min`/`apn_max`: el registro sigue exponiendo
   `total_anos_apn__gte/__lte`; el repositorio los traduce a la anotación
   `apn_oficial__gte/__lte`.
6. **Columna del reporte:** las filas incorporan `total_anos_apn` con el valor
   oficial redondeado, y la columna se agregó a `ResultadoReporte.columnas`.
7. **Autogestión:**
   - `repo_autogestion_orm`: el detalle del censo usa `calcular_total_apn` sobre
     los antecedentes.
   - `excel_service`: el queryset se anota con `anotar_apn_oficial` una vez y
     cada fila usa `emp.apn_oficial` (sin N+1).

No se modificó ni eliminó la columna `Employee.total_anos_apn`, el trigger
`trg_actualizar_apn` ni la función `calcular_total_apn()` de PostgreSQL.

## Archivos

**Backend**
- `apps/personal/shared/domain/services/tiempo_servicio.py`: nueva
  `anios_fraccionarios`.
- `apps/personal/infrastructure/mappers/mapper_personal.py`: usa la conversión
  única.
- `apps/personal/infrastructure/repositories/consultas_apn.py`: anotación
  `anotar_apn_oficial`.
- `apps/reportes/infrastructure/repositories/repo_reportes_orm.py`: anotación,
  traducción de filtros/agrupación y columna `total_anos_apn`.
- `apps/autogestion/infrastructure/repositories/repo_autogestion_orm.py`: total
  APN oficial en el detalle del censo.
- `apps/autogestion/infrastructure/services/excel_service.py`: APN oficial en el
  Excel del censo.

**Tests**
- `tests/integration/reportes/test_apn_oficial.py`: paridad SQL/Python con
  cerrados, abiertos, día 31, febrero/bisiesto y fechas nulas; filtros y columna
  contra la columna legada.
- `tests/integration/reportes/test_reporte_personal_orm.py`: los filtros APN
  ahora se alimentan con antecedentes cerrados.
- `tests/unit/autogestion/test_censo_precargado.py`: total APN desde
  antecedentes.

**Frontend**
- `e2e/g9-antiguedad-apn.spec.ts`: en vivo, filtra por APN y compara hasta 5
  empleados con `/personal/{cedula}/`.

## Paridad SQL/Python

- **Casos del test:** cierre normal, día 31, 29 de febrero, antecedente abierto
  y varios años en un mismo empleado. Todos dentro de `1e-4`.
- **Muestra local real:** la BD local tiene **1022 empleados**, pero solo **5
  con antecedentes** (4 con antecedentes cerrados). Se compararon los 5:
  **0 diferencias**.
- **Muestra de 250 empleados en la BD local:** como la BD no tiene 200
  empleados reales con antecedentes, se generó una muestra temporal de 250
  empleados con 1–3 antecedentes variados (cerrados/abiertos, días 31,
  febrero), se comparó la anotación SQL con Python y se hizo **rollback**
  (no quedó dato). Resultado: **250/250 dentro de 1e-4, 0 diferencias**.
- **Limitación reportada:** no fue posible una muestra de 200 empleados *reales*
  con antecedentes porque la BD local solo contiene 5. No se inventaron datos
  permanentes ni se tocaron empleados reales.

## Pruebas

| Verificación | Resultado |
|---|---|
| Backend completo | **1131 passed** (base 1127 de la entrega anterior; +4) |
| Focalizado G9 | 27 passed |
| Vitest completo | **97 archivos / 571 pruebas** |
| `tsc --noEmit` | sin errores |
| `next build` | OK (imagen `nextjs` reconstruida) |
| `eslint` (nuevo E2E) | sin errores |
| `lint-imports` | 82 kept, 0 broken |
| `makemigrations --check` | No changes detected |

## Verificación en vivo

Se reconstruyeron las imágenes (`docker compose build django nextjs`), se levantaron los servicios y se ejecutó Playwright (Chromium) contra `http://localhost:3001`:

- **E2E G9:** 1/1. El reporte se pidió con `apn_min=0.0001` (solo cuentas con antigüedad oficial > 0); se compararon las filas con `/api/v1/personal/{cedula}/` (misma función oficial del mapper) y se comprobó que el filtro `apn_min` no devuelve valores por debajo del mínimo.
- **Reporte real filtrado:** 4 filas con antigüedad oficial > 0 y 1 con APN oficial 0 (la BD local tiene 5 empleados con algún antecedente; uno solo tiene abierto) = 5 fichas comparadas. Comparación reporte vs ficha:

| Cédula | Reporte | Ficha | ¿Igual? |
|---|---|---|---|
| 18708853 | 5.3048 | 5.3048 | Sí |
| 17123240 | 5.3048 | 5.3048 | Sí |
| 17286638 | 3.5943 | 3.5943 | Sí |
| 17144181 | 7.0521 | 7.0521 | Sí |
| 30540767 | 0.0 | 0.0 | Sí (solo antecedente abierto) |

La columna legada para esas mismas cédulas da 5.30, 5.32, 3.59 y 7.04, lo que confirma que el reporte ya no la usa. La columna `total_anos_apn` está presente en `ResultadoReporte.columnas` y en cada fila.
## Pendientes

- Ninguno de G9.
- La definición de «Fecha APN» sigue pendiente de RRHH (M8), fuera de G9; el
  filtro de años APN ya usa la antigüedad oficial.
