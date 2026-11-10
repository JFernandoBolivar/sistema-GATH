# Comparativa — Reporte de trabajadores (ejemplo RRHH vs sistema)

**Fecha:** 2026-11-10
**Estado:** **APLICADO** (P1–P5 implementadas y verificadas contra la BD real).

> Resultado de la verificación: el PDF del sistema ahora tiene el mismo
> encabezado institucional, la agrupación por NIVEL y DG/GEREN/OFIC, las 10
> columnas, el sexo abreviado, el total en el pie y filas compactas.
> Con 896 trabajadores el archivo pasó de 82 a 57 páginas.

## Insumos

| Documento | Origen | Datos | Páginas |
|---|---|---|---|
| `Reporte_Empleados 28_10_2026.pdf` | Ejemplo entregado por RRHH | 867 empleados · 404 M · 463 F · generado 28/10/2026 08:26 | 103 |
| `reporte_sistema.pdf` (generado para comparar) | Sistema GATH, ruta `/reportes/empleados` | 896 empleados · 405 M · 491 F · generado 09/11/2026 21:09 | 82 |

La diferencia de totales y fechas es de datos, no de diseño.

## Veredicto

El PDF del sistema **ya tiene la misma base visual** que el ejemplo: A4 horizontal,
logos institucionales a los lados, título centrado, banda de totales, tabla con
las mismas columnas, cinta tricolor al pie y numeración de página. La brecha
principal es la **agrupación jerárquica** y algunos ajustes de composición.

Se puede considerar un **80 % alineado**. Para igualar el ejemplo faltan cinco
cosas concretas.

## Comparación visual

| Elemento | Ejemplo RRHH | Sistema actual | Veredicto |
|---|---|---|---|
| Encabezado | «COMISIÓN NACIONAL DE TELECOMUNICACIONES (CONATEL)» + «REPORTE DE TRABAJADORES» | Solo «REPORTE DE PERSONAL ACTIVO» | Falta la línea institucional y el título exacto |
| Logos | Ministerio (izq.) + Bicentenario (der.) | Iguales | **Igual** |
| Banda de totales | Total / Masculino / Femenino | Igual, con los datos del momento | **Igual** |
| Agrupación | Por **NIVEL** y por **DG / GERENCIA / OFICINA** con bandas grises y encabezado repetido | Tabla plana, sin grupos | **Diferencia principal** |
| Numeración `#` | Se reinicia en cada grupo | Correlativa global | Diferencia |
| Columnas | 10: #, Código, Cédula, Nombres, Apellidos, F. Ingreso, Sexo, Tipo de Nómina, Cargo, Organismo | 11: agrega **Total años APN** | Diferencia |
| Sexo | `M` / `F` | `MASCULINO` / `FEMENINO` | Diferencia menor |
| Anchos | Proporcionados a 10 columnas | Al haber 11, cae en anchos iguales y parte los textos | Consecuencia de la columna extra |
| Altura de fila | Compacta, una línea cuando cabe | Más alta y con textos partidos | Diferencia menor |
| Pie | «Total de empleados: 867 \| Generado: …» + Página | «Generado: …» + Página | Falta el total |
| Cinta tricolor | Sí | Sí | **Igual** |
| Densidad | 103 páginas / 867 | 82 páginas / 896 | El sistema es más denso |
| Filtros aplicados | No se muestran | El motor puede imprimirlos | El sistema tiene más capacidad |

## Diferencias de fondo

### 1. La agrupación no se aplica a las listas

El formulario del sistema envía por defecto `agrupar_por: "direccion_general"`
y `tipo_reporte: "lista"`, pero el motor solo usa la agrupación para los reportes
de **conteo** (`repo_reportes_orm.py`). En modo lista devuelve una tabla plana.
El ejemplo sí agrupa la lista:

```
NIVEL: NIVEL SUPERIOR
  > DG / GEREN / OFIC: UNIDAD DE AUDITORIA INTERNA
     1 02000005 ...
  - DIV / COORD: COORDINACION DE CONTROL POSTERIOR...
     1 02020001 ...
  > DG / GEREN / OFIC: DIRECCION GENERAL
     1 03000001 ...
```

Cada grupo repite el encabezado de la tabla y reinicia el `#`.

### 2. La columna «Total años APN» rompe el formato

El ejemplo no la tiene. Al agregarla, el motor deja de reconocer la lista de 10
columnas con anchos fijos y reparte el ancho en partes iguales; por eso los
nombres, apellidos y cargos se parten en dos líneas. Si se quita de la lista
por defecto (o se deja como opción), el PDF recupera los anchos del ejemplo.

### 3. Encabezado y pie

- Falta la línea «COMISIÓN NACIONAL DE TELECOMUNICACIONES (CONATEL)» sobre el
  título.
- El título del ejemplo es «REPORTE DE TRABAJADORES»; el sistema usa
  «REPORTE DE PERSONAL ACTIVO» (correcto por tipo, pero distinto).
- El pie del ejemplo incluye el total de empleados; el sistema solo la fecha y
  la página.

### 4. Detalle de presentación

- El ejemplo abrevia el sexo (`M`/`F`); el sistema imprime la palabra completa,
  lo que ensancha la columna.
- El ejemplo tiene filas más compactas y una sola línea cuando el texto cabe.
- El ejemplo separa los grupos con una banda gris y un espacio; el sistema no
  tiene separadores.

## Lo que ya está bien

- Formato horizontal A4 y márgenes.
- Logos institucionales y cinta tricolor.
- Banda de totales con Total / Masculino / Femenino.
- Orden y nombres de las 10 columnas base.
- «N/A» en fecha de ingreso cuando no existe.
- Pie con fecha de generación y número de página.
- Filtros y columnas configurables por el motor de reportes.

## Recomendaciones (por prioridad)

### P1 — Agrupar la lista por nivel y unidad

- Extender el motor de listas para aceptar `agrupar_por` (nivel, dependencia,
  dirección general, dirección de línea, coordinación).
- Agrupar por `nivel` y, dentro, por `direccion_general` (como el ejemplo).
- Renderizar una **banda gris** por grupo con el texto:
  - `NIVEL: <nivel>`
  - `> DG / GEREN / OFIC: <dirección general>`
  - `- DIV / COORD: <dirección de línea / coordinación>` cuando aplique.
- Repetir el encabezado de la tabla en cada grupo y reiniciar el `#`.

### P2 — Columnas por defecto

- Dejar por defecto las 10 columnas del ejemplo.
- Mover «Total años APN» a columna opcional (el usuario la activa si la quiere).
- Con 10 columnas se recuperan los anchos fijos y desaparece el corte de texto.

### P3 — Encabezado y pie

- Agregar la línea institucional «COMISIÓN NACIONAL DE
  TELECOMUNICACIONES (CONATEL)» sobre el título.
- Usar «REPORTE DE TRABAJADORES» como título del reporte de personal.
- Añadir «Total de empleados: N» al pie, antes de «Generado».

### P4 — Densidad y sexo

- Abreviar `M`/`F` en el PDF (mantener la palabra completa en la interfaz).
- Reducir el padding vertical y permitir una sola línea cuando el texto quepa.
- Mantener el salto de línea solo para nombres/apellidos realmente largos.

### P5 — Mantener

- Banda de totales, logos, cinta tricolor, «N/A» y numeración de página.

## Criterios de aceptación

- El PDF del sistema agrupa por nivel y dirección general como el ejemplo.
- Cada grupo repite el encabezado de tabla y reinicia el `#`.
- La tabla por defecto tiene 10 columnas, sin «Total años APN».
- El encabezado incluye la línea de CONATEL y el pie el total de empleados.
- El sexo se imprime como `M`/`F`.
- Los textos de nombres, apellidos y cargos no se parten cuando caben en su
  columna.
- La banda de totales, los logos y la cinta se conservan.

## Implementación (2026-11-10)

| Prioridad | Cambio | Archivo |
|---|---|---|
| P1 | Listas agrupadas por NIVEL → DG → Div/Coord, con banda gris, encabezado repetido y `#` reiniciado. `CondPageBreak` evita bandas huérfanas. | `repo_reportes_orm.py`, `report_pdf.py`, `pdf_components.py` |
| P2 | El PDF/Excel por defecto imprime 10 columnas; «Total años APN» sigue en el JSON y en la tabla de la interfaz. | `exportacion.py` |
| P3 | Encabezado con «COMISIÓN NACIONAL DE TELECOMUNICACIONES (CONATEL)» en dos líneas, título «REPORTE DE TRABAJADORES» y pie «Total de empleados: N \| Generado: …». | `pdf_components.py`, `report_pdf.py`, `repo_reportes_orm.py` |
| P4 | Sexo `M`/`F` y padding vertical reducido (filas compactas). | `exportacion.py`, `pdf_styles.py` |
| P5 | Se conservan banda de totales, logos, cinta tricolor, «N/A» y numeración. | — |

### Verificación

- `pytest tests/integration/reportes`: **62 pruebas aprobadas**.
- `pytest tests/unit/core/test_report_pdf.py test_encabezado_pdf.py test_report_excel.py`: **11 pruebas aprobadas**.
- PDF real con 896 trabajadores: **57 páginas**, agrupado y con las 10 columnas.
- Imagen del backend reconstruida y verificada dentro del contenedor (`pdfinfo`: 57 páginas, A4 horizontal).
- Evidencia visual: `reporte_pdf\v2_pagina_1.png` y `v2_pagina_2.png` en la carpeta temporal de la sesión.
