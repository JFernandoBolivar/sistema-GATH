# FIX-FILTROS-NOTIFICACIONES — Filtros legibles y alineados

**Fecha:** 2026-11-09
**Rama:** `feature/fe-de-vida-pasivos`

## Problema reportado

En `/autogestion/notificaciones` los filtros de Tipo, Estado, Desde y Hasta se
veían desalineados y demasiado pequeños: los nombres y las fechas no se leían y
el calendario del campo de fecha no se podía abrir con comodidad.

## Causa

La página envolvía sus cuatro filtros en una grilla propia y los pasaba como un
solo hijo a `BarraFiltros`. Ese componente ya aplica su grilla de 4 columnas en
escritorio, así que el único hijo ocupaba **una** columna y, dentro, cada filtro
quedaba en ~1/4 de esa columna (unos 60 px). Lo mismo ocurría en la bandeja de
solicitudes de carnetización.

## Corrección

- Se eliminó el envoltorio de grilla interno en las dos páginas: los campos se
  pasan directamente a `BarraFiltros` y ocupan las 4 columnas de escritorio
  (2 en tablet, 1 en teléfono).
- Campos más legibles: etiquetas `text-sm` con color de texto normal y controles
  `h-11` (44 px) de ancho completo.
- Los campos de fecha muestran el indicador del calendario a 20 px y con cursor
  de puntero, para poder abrirlo sin precisión extrema.
- En la bandeja de solicitudes de carnetización se aplicó el mismo ajuste
  (Estado y Población).

## Verificación

- `vitest` de notificaciones + solicitudes de carnetización: **42 passed**.
- `tsc --noEmit`: 0 errores · `eslint`: 0.
- En escritorio los cuatro filtros llenan la fila; en teléfono se apilan a ancho
  completo dentro del bloque colapsable.
