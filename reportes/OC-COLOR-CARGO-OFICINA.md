# Reglas de color: sugerencias de cargo y oficina (12/11/2026)

**Rama:** `feature/fe-de-vida-pasivos` — **Sin commit.**
**pytest no ejecutado** (lo corre el coordinador).

---

## 1. Problema

En `/carnetizacion/disenador`, el panel «Reglas de Color» solo precargaba los
tipos de nómina. Con «Por Cargo del Titular» y «Por Oficina / Dependencia» el
datalist salía vacío (`sugerenciasCriterio` devolvía `[]`) y el usuario no sabía
qué texto escribir.

## 2. Backend

### Endpoint

`GET /api/v1/carnetizacion/reglas-color/sugerencias/`

- Permiso: `IsAuthenticated` + `HasPermission('carnetizacion.disenar')` (el mismo
  del diseñador).
- Respuesta: `{"status": "success", "message": "...", "data": {"cargos": [...], "oficinas": [...]}}`.
- Solo lectura; no escribe ni audita datos.

### Fuente del texto

El PDF toma `datos.cargo` de `str(asignacion.denominacioncargoid)` y
`datos.departamento` de `asignacion.DireccionGeneral.direccion_general` del
**último** `AsigTrabajoModel` del empleado (`order_by('-fecha_actualizacion')`).
Para que no haya dos copias de esa regla se extrajo el helper:

- `apps/carnetizacion/infrastructure/repositories/repo_carnetizacion_comun.py`
  → `cargo_y_departamento(asignacion)`.
- `repo_carnetizacion_pdf.py` (`generar_pdf` y `generar_vista_previa`) ahora usa
  el helper, así el endpoint y el PDF no pueden divergir.

### Selección de valores

`apps/carnetizacion/infrastructure/repositories/repo_carnetizacion_sugerencias.py`
(`RepoSugerenciasColorMixin`):

1. Toma la asignación más reciente de cada empleado (la misma que usaría el PDF).
2. Incluye solo si ese último cargo tiene `estatus = ACTIVO`
   (`iexact`, sin distinguir mayúsculas).
3. Normaliza con `.strip().upper()`, descarta vacíos y **deduplica con
   `normalizar_clave`**, la misma función que usa `resolver_color_carnet`
   (quita acentos, unifica mayúsculas, espacios y guiones). Dos variantes como
   `ANALISTA` y `ANALÍSTA` producen una sola regla, porque el resolutor las
   compara igual.
4. Devuelve ambas listas ordenadas.

`resolver_color.py` expone ahora `normalizar_clave` (antes `_normalizar_clave`)
para que la infraestructura use exactamente la misma comparación.

### Capas Onion

| Capa | Archivo |
|---|---|
| Dominio (puerto) | `apps/carnetizacion/domain/ports/repo_carnetizacion.py` → `sugerencias_reglas_color()` |
| Aplicación | `apps/carnetizacion/application/use_cases/sugerencias_reglas_color.py` |
| Infraestructura | `apps/carnetizacion/infrastructure/repositories/repo_carnetizacion_sugerencias.py` (mixin compuesto en `repo_carnetizacion_orm.py`) |
| Presentación | `SugerenciasReglasColorView` en `presentation/views/carnetizacion_views.py`; ruta en `presentation/urls.py` |

## 3. Frontend (Scream + Onion)

- **Dominio** (`domain/entities/disenador.ts`):
  - `SugerenciasReglasColor` (`{cargos, oficinas}`).
  - `sugerenciasCriterio(criterio, tiposExternos, sugerencias)` devuelve las
    listas reales para `cargo`/`oficina` y mantiene el comportamiento de
    `nomina` con los tipos de credencial externa.
  - `cargarValoresSugeridos(reglas, valores)` añade los valores que aún no
    tienen regla usando el `respaldo` vigente, sin mutar ni pisar los ya
    configurados.
- **Puerto** (`domain/ports/repo-carnetizacion.ts`):
  `obtenerSugerenciasReglasColor()`.
- **Infraestructura**: `getSugerenciasReglasColor` en
  `infrastructure/http/carnetizacion-api.ts`, su implementación en
  `infrastructure/repositories/repo-carnetizacion-api.ts` y la server action
  `getSugerenciasReglasColorAction` con el mismo patrón de auditoría/errores que
  las demás.
- **UI**:
  - `ui/views/disenador-view.tsx` carga las sugerencias con SWR y pasa
    `sugerenciasReglasColor` / `cargandoSugerencias`.
  - `ui/components/disenador/disenador-reglas-color-panel.tsx`: el datalist
    ofrece cargos u oficinas según el criterio; el botón
    «Cargar todos (n)» añade los valores con el color de respaldo; mientras
    carga muestra «Cargando sugerencias…» y el botón queda deshabilitado; sin
    valores el botón muestra `(0)` deshabilitado y no toca el texto actual.

## 4. Pruebas

- **pytest** (no ejecutado aquí):
  `tests/integration/carnetizacion/test_sugerencias_reglas_color.py`
  - valores del último cargo activo por titular;
  - coincidencia exacta con `cargo_y_departamento` (la fuente del PDF);
  - el último cargo VACANTE excluye también el cargo activo anterior;
  - sin permiso de diseño → 403;
  - sin datos → listas sin cadenas vacías;
  - deduplicación de variantes con acentos.
- **vitest**:
  - `domain/entities/disenador.test.ts`: sugerencias de cargo/oficina,
    aislamiento entre criterios, sin listas no inventa valores,
    `cargarValoresSugeridos` (respaldo, respeta existentes, ignora vacíos, no
    muta).
  - `ui/components/disenador/disenador-reglas-color-panel.test.tsx`: datalist de
    cargos y oficinas, «Cargar todos», botón deshabilitado sin sugerencias y
    estado de carga.
  - Mocks de `RepoCarnetizacion` actualizados en
    `use-cases/carnetizacion.test.ts` y `use-cases/disenar-carnet.test.ts`.

## 5. Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `python manage.py check` | sin incidencias |
| `python -m compileall -q apps core tests` | OK |
| `ruff check <archivos tocados> --select F` | All checks passed |
| `lint-imports` | 103 contratos, 0 rotos |
| `npx tsc --noEmit` | OK |
| `npx eslint <archivos tocados> --quiet` | OK |
| `npx vitest run src/modules/carnetizacion` | 24 archivos, 149 pruebas OK |

## 6. Notas

- `qr_institucional.py` apareció en el árbol de trabajo con un `return` partido
  en dos líneas (error de sintaxis de una edición concurrente, ajena a esta
  tarea). Se corrigió el escape a `'\n'.join(lineas) + '\n'` para poder correr
  `compileall`/`lint-imports`; no se tocó nada más de ese archivo.
- El resto de archivos modificados que aparecen en `git status` pertenecen a
  otras tareas en curso. Esta tarea no hizo commit ni push.
