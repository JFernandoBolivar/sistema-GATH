# FIX-CARGA4 — Crear el cargo y asignarlo desde la carga masiva

**Fecha:** 2026-11-09
**Rama:** `feature/fe-de-vida-pasivos`
**Estado:** implementado y probado en backend; **sin commit**.

## Alcance

Cada fila de «Cargo y asignación» ahora **crea el cargo** (código generado por el
backend) y lo **asigna** al trabajador en el mismo paso. Se eliminó la columna
«Código de cargo».

## Cambios

### Registro de campos (`registro_campos.py`)
Nuevas columnas de la hoja:
`cedula`, `denominacion_id`, `especifica_id`, `dependencia_id`,
`direccion_general_id`, `direccion_linea_id`, `coordinacion_id`, `grado_id`,
`organismo_id`, `tipo_nomina_id`, `fecha_ingreso`, `motivo_id`.
La clave de negocio es cédula + denominación + dependencia + fecha de ingreso.

### Resolución y previsualización (`cargo_resolucion.py`)
- Convierte los nombres del Excel a ids y valida la jerarquía:
  nivel → dirección general → dirección de línea → coordinación.
- Valida que la nómina sea de personal activo y resuelve el motivo de ingreso.
- `previsualizar_codigo` usa la **misma** generación de código que `crear_cargo`
  (`RepoCargosORM._codigo_para`), sin escribir nada.

### Análisis (`analisis.py`)
- La fila de cargo muestra: `Se creará el cargo <código> y se asignará al trabajador.`
- El movimiento pasivo→activo incluye el código previsto y sus datos de cargo.
- Se permite la fila de cargo de un alta nueva si la misma carga trae su
  `datos_personales`; el alta se aplica primero.

### Aplicación y reversión (`aplicacion.py`)
- `_aplicar_cargo` reutiliza el caso de uso `crear_cargo` + `asignar_cargo_a_empleado`
  (historial de Movimientos), sin duplicar la lógica del código.
- Guarda `cargo_id`, `cargo_codigo`, `cargo_creado` y el antecedente creado.
- La reversión **desasigna y elimina el cargo creado** y el antecedente que creó.

### Plantilla Excel (`plantilla_excel.py`)
- Catálogos nuevos: denominación, específica, dependencia, dirección general,
  dirección de línea, coordinación y grado.
- Hojas ocultas y rangos nombrados para las **listas dependientes**:
  `NivelesDirecciones` (DG_n), `DireccionesLineas` (DL_n) y
  `LineasCoordinaciones` (CO_n), con validación `INDIRECT`/`MATCH` como la del
  código postal.
- Ya no se genera la columna «Código de cargo».

## Verificación

- `tests/integration/carga_masiva` + `tests/unit/carga_masiva`: **51 passed**.
- Nueva prueba de plantilla: columnas nuevas, sin «Código de cargo» y hojas
  dependientes presentes → **1 passed**.
- `lint-imports`: 91/0 · `makemigrations --check`: sin cambios.
- `manage.py check`: sin incidencias.

## Pendiente

- Los fixtures E2E de carga masiva (`c01_activos_valido.xlsx`, `c13_*`) todavía no
  traen una fila de cargo con las columnas nuevas; la suite E2E sigue en verde
  (no ejercita la creación todavía). Hay que regenerar la base desde la nueva
  plantilla y añadir la fila de cargo antes de darlo por cerrado en E2E.
- El detalle del análisis muestra el código en el texto de la fila; no requirió
  cambios de frontend adicionales.
