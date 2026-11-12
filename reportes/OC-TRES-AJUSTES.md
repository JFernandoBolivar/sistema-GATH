# Tres ajustes aprobados (12/11/2026)

**Rama:** `feature/fe-de-vida-pasivos` — **Sin commit.**
**pytest no ejecutado** (lo corre el coordinador).

---

## 1. Vivienda: regla «otro país / Venezuela»

### Regla única

`NextJS/src/shared/domain/vivienda-ubicacion.ts`:

- `camposViviendaVisibles(pais, hayVivienda)` devuelve qué bloques se ven:
  - exterior → `mostrarPais`, `mostrarCiudadRegion`, sin geografía nacional;
  - Venezuela → `mostrarUbicacionVenezuela` (estado, municipio, parroquia,
    código postal), sin ciudad o región.
- `nombreEsVenezuela(nombre)` interpreta el nombre formateado del catálogo y
  devuelve `null` mientras no está resuelto («Cargando…», «—», «Código N»).

### Revisión de fe de vida (Bienestar)

`NextJS/src/modules/fe-de-vida/ui/bienestar/modelo-revision.ts`:

- El país que manda es el **propuesto** (`datos_vivienda.pais_id`) si el pasivo
  lo cambió; si no, el vigente de la ficha.
- Se consumen **todos** los campos con `k.dato` (aunque el país oculte un
  bloque), así `datos_vivienda.ciudad_region` queda en la sección Vivienda y no
  cae en «Otros datos propuestos».
- Venezuela: Estado, Municipio, Parroquia y Código postal (sin País ni Ciudad).
  Exterior: País, Ciudad o región, Dirección y Condición.

### Ficha del pasivo y del trabajador

- `mapper-personal.ts` mapea `pais_es_venezuela` (ya venía del backend en
  `vivienda_a_dict`).
- `DatosVivienda` y `DetalleViviendaVM` llevan `paisEsVenezuela`.
- `empleado-detalle-sheet.tsx` (usado por la ficha del pasivo vía
  `detalle-pasivo.tsx` y por el expediente del trabajador) aplica
  `camposViviendaVisibles`: en el exterior ya no muestra Estado/Municipio/
  Parroquia/Código postal, y en Venezuela no muestra País/Ciudad.

### Solicitud del portal

- `formulario-registro.tsx` ya ocultaba los campos correctos; ahora el filtro
  se expresa con `camposViviendaVisibles` en vez de repetir la condición, para
  que la regla viva en un solo lugar.
- También se aplicó la misma regla a `mi-expediente-view.tsx`, que mostraba la
  geografía venezolana aunque la vivienda fuera del exterior.

### Pruebas

- `shared/domain/vivienda-ubicacion.test.ts`: Venezuela, exterior, sin país y
  nombres sin resolver.
- `modelo-revision.test.tsx`:
  - Venezuela → Estado/Municipio/Parroquia/Código postal;
  - exterior sin cambio → País/Ciudad;
  - Venezuela → Albania con país y ciudad propuestos → manda el propuesto y
    Ciudad queda en Vivienda (no en «Otros»).
- `formulario-registro-vivienda.test.tsx` sigue cubriendo ambos países.

## 2. Documentos del familiar: uno por tipo

### Backend

- Puerto `RepoFamiliares`: `obtener_documento_por_tipo()` y
  `obtener_clave_documento_por_tipo()`.
- `RepoFamiliaresORM`: ambos métodos ordenan por `-uploaded_at, -pk` (si hay
  duplicados viejos, operan sobre el más reciente sin borrar los demás).
- `subir_documento_familiar()`: si ya existe un documento del mismo tipo,
  reemplaza el archivo del **mismo registro**; si no, crea.
- `DocumentosFamiliarListView.post`:
  - 404 si el familiar no existe (antes podía subir el archivo y fallar después);
  - `transaction.atomic()` para el reemplazo;
  - borra del almacenamiento la clave anterior al final (si el almacén falla,
    se revierte y el registro viejo sigue apuntando a su archivo);
  - auditoría: `familiares.documento_subido` / `familiares.documento_reemplazado`.
- `DocumentoFamiliarDetailView.patch`: también borra el archivo anterior y
  audita el reemplazo.

### Frontend

`familiar-documentos-actualizacion.tsx`:

- Si el tipo elegido ya existe, avisa «Ya hay una cédula cargada; se
  reemplazará.» y el botón pasa a «Reemplazar documento».
- El toast distingue «Documento reemplazado» de «Documento agregado».

### Datos existentes (solo lectura, sin borrar nada)

Consulta de solo lectura sobre la base actual:

```
GRUPOS_DUPLICADOS= 1
FAMILIARES_CON_DUPLICADOS= 1
{'familymember_id': 5677, 'document_type': 'cedula', 'total': 2}
```

**1 familiar** tiene dos cédulas (familiar 5677, tipo `cedula`). No se borró
ningún dato; a partir de ahora una nueva subida reemplaza el registro más
reciente.

### Pruebas

- pytest escrito (no ejecutado): subir la cédula dos veces deja un solo
  documento, la partida sigue siendo otro documento y se audita el reemplazo.
  Se actualizó el test del `PATCH` para comprobar que también elimina el
  archivo anterior.
- vitest: texto del botón y aviso de reemplazo por tipo.

## 3. Diseñador: textos de botones que se desbordan

- `disenador-herramientas-panel.tsx`:
  - botones de Formas, Texto y Gráficos: `whitespace-normal h-auto min-h-10
    py-1.5 text-left leading-tight`;
  - tarjetas de Formas institucionales: `whitespace-normal` y la etiqueta ya no
    usa `truncate` («Encabezado diagonal», «Franja de esquina», «Pie diagonal
    izquierdo» ya pueden partirse en dos líneas).
- `disenador-reglas-color-panel.tsx`: la fila de «Nuevo valor / Cargar todos /
  Añadir» y la de «Seleccionar todos los filtrados / Quitar todos» ahora usan
  `flex-wrap`, para que no desborden en el panel de ~208 px.
- Revisados los demás paneles: capas, propiedades y toolbar ya usan `truncate`,
  `flex-wrap` o botones de icono; no se encontró otro desborde.

## Verificación

| Comando | Resultado |
|---|---|
| `python manage.py check` | sin incidencias |
| `python -m compileall -q apps core tests` | OK |
| `ruff check apps/familiares --select F` | All checks passed |
| `lint-imports` | 103 contratos, 0 rotos |
| `npx tsc --noEmit` | OK |
| `npx eslint src --quiet` | OK |
| `vitest` de fe-de-vida, autogestion, familiares, personal, carnetizacion y `shared/domain` | 122 archivos, 678 pruebas OK |

No se ejecutó pytest.
