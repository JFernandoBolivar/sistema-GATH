# FIX-CARGA5 — Mención en formación académica y procedencia en formación complementaria

**Fecha:** 2026-11-09
**Rama:** `feature/fe-de-vida-pasivos`

## Alcance

Completa la plantilla de carga masiva con los dos campos que faltaban:

1. **Formación académica → Mención (opcional).** La lista de menciones depende
   de la carrera seleccionada en «Título / Carrera». Si se indica una mención
   sin carrera o de otra carrera, la fila se rechaza con un mensaje claro.
2. **Formación complementaria → Procedencia (INTERNA / EXTERNA).** Es
   obligatoria. Si es **INTERNA** (formación dentro de CONATEL) no se exige
   institución y la celda de institución se ignora. Si es **EXTERNA**, la
   institución es obligatoria.

## Cambios

### Registro de campos (`registro_campos.py`)
- `formacion_academica`: nuevo `mencion_id` (catálogo `mencion`, opcional) entre
  «Título / Carrera» e «Institución». La clave de negocio pasa a incluir la
  carrera y la mención.
- `formacion_complementaria`: nuevo `procedencia` (catálogo
  `tipo_procedencia`, obligatorio). La institución deja de ser obligatoria; su
  ayuda indica que solo aplica a procedencia externa.

### Plantilla Excel (`plantilla_excel.py`)
- Catálogo nuevo `tipo_procedencia` (INTERNA / EXTERNA).
- Hoja oculta `CarrerasMenciones` (carrera → mención) y validación dependiente
  con `OFFSET/COUNTIF`: al elegir la carrera, el desplegable de mención solo
  muestra sus menciones. Se usa una sola hoja ordenada porque el catálogo tiene
  más de 6.000 menciones (un rango nombrado por carrera sería inviable).
- La mención no va al catálogo plano para no duplicar etiquetas (una misma
  mención se repite en varias carreras).

### Análisis (`analisis.py`)
- Valida `mencion` y `tipo_procedencia` contra sus catálogos.
- Mención sin carrera o que no pertenece a la carrera → error.
- Procedencia `EXTERNA` sin institución → error; procedencia `INTERNA` limpia
  la institución.

### Aplicación (`aplicacion.py`)
- Guarda `mencion_id` en `FormacionAcademicaModel`.
- Guarda `procedencia_id` en `FormacionComplementariaModel` y deja la
  institución en nulo cuando la procedencia es interna.

## Verificación

- `tests/integration/carga_masiva` + `tests/unit/carga_masiva`: **54 passed**.
- Pruebas nuevas: mención dependiente de la carrera, procedencia
  interna/externa y hoja `CarrerasMenciones` en la plantilla.
- `lint-imports`: 91 contratos, 0 rotos.
- `makemigrations --check`: sin cambios.

## Plantilla de prueba

Se entrega un archivo listo para cargar en `plantillas_prueba/` con filas de
ejemplo de formación académica (con mención) y complementaria (interna y
externa) para probar el flujo completo en QA.
