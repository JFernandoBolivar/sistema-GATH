# Plan de reconstrucción visual de `modules/*` (paridad con el legado) — 2026-09-15

> **Estado: EN PAUSA por orden directa del coordinador.** Este documento reemplaza,
> por ahora, la ejecución directa. No se toca más código ni los servidores
> levantados hasta nueva instrucción.

## 0. Encargo original y decisión de alcance

El usuario coordinador reportó que el look & feel de `modules/*` (páginas nuevas
construidas durante la migración Onion de esta sesión) no replica el legado, aunque
`globals.css` (tema/colores) es prácticamente idéntico entre este repo y el de
referencia. El problema no es el tema global sino la **composición/layout** de cada
pantalla.

Repo de referencia: `/home/jbolivar@conatel.gob.ve/Documentos/sistemas/gath-CON AJUSTES EN APN`
(branch `feature/mejoras-sistema`) — repo git independiente, **solo lectura**, no se
tocó ni se commiteó nada ahí.

Tras comparar personal/cargos/organización contra el legado y el repo de referencia,
se confirmó que la divergencia es un **cambio de patrón de navegación completo**, no
solo de columnas/orden de campos:

- **Legado/referencia**: flujo multi-página por acción (rutas separadas para
  crear/editar/listar), `DataTable` (tanstack) con menú "Columnas" y menú
  desplegable de acciones por fila (`MoreHorizontal` → dropdown), `Sheet` de detalle
  con los diálogos de edición embebidos dentro (no en el listado).
- **`modules/*` (esta sesión, antes de este ajuste)**: una sola página por módulo,
  con formulario de alta/edición siempre visible arriba, tabla HTML plana (no
  tanstack) debajo, botones de ícono sueltos en la fila en vez de menú desplegable.

Se preguntó al coordinador cómo proceder (`ask`, con 3 opciones + "verlo primero").
**Decisión del coordinador: reconstrucción completa (opción 1)**, usando el repo de
referencia como **plantilla exacta** — mismas rutas, mismo `DataTable`+dropdown,
mismos `Sheet`, mismos formularios multi-paso donde el legado los tenga.

**Alcance preciso confirmado por el coordinador:** esto es una reconstrucción de la
capa **`ui/` (presentación) únicamente**. `domain/application/infrastructure` de los
12 módulos (auditados, con 190+147 tests pasando, verificados E2E contra la BD real
en una tarea anterior) se mantiene intacto — no se descarta ni se reconstruye, solo
se consume desde la nueva `ui/`. Si un caso de uso necesario para replicar una
pantalla legado no existe, se agrega en `application/` siguiendo el patrón
establecido, pero no se reescribe lo que ya funciona.

El coordinador pidió construir primero un `DataTable` + menú de acciones genérico en
`shared/ui/` para que los 12 módulos lo reutilicen, y luego ir módulo por módulo con
commits atómicos, reportando progreso (no esperar a terminar los 12).

---

## 1. Lo que ya está hecho y COMMITEADO

**Commit `5330131`** — `feat(frontend): DataTable + DataTableColumnHeader compartidos (tanstack)`:

- `NextJS/src/shared/ui/components/data-table.tsx` — tabla genérica sobre
  `@tanstack/react-table` (ya era dependencia del proyecto, no hubo que instalarla).
  Réplica del patrón legado (`gestion-trabajadores/components/employees/tableEmployees/data-table.tsx`):
  menú "Columnas" para mostrar/ocultar, filtrado/orden/selección vía tanstack. Se le
  agregó un slot `toolbar` opcional (para que cada módulo inserte su buscador/botón
  "Nuevo" sin tocar el componente) y un `emptyMessage` configurable — únicas
  diferencias respecto al legado, ambas aditivas y no visuales.
- `NextJS/src/shared/ui/components/data-table-column-header.tsx` — encabezado
  ordenable/ocultable, réplica exacta del legado.
- Verificado: `npx tsc --noEmit` 0 errores nuevos.

Este componente es la base para reconstruir los 12 módulos.

---

## 2. Módulo `personal` — reconstrucción EN CURSO, código escrito pero **NO COMMITEADO**

Se investigó el legado equivalente en el repo de referencia
(`gestion-trabajadores/personal-trabajador/{registrar,consultar}` +
`components/employees/tableEmployees/{data-table,data-table-column-header,columns,detail-info}.tsx`,
ya leídos en detalle en una tarea anterior de esta sesión) y se rediseñó `ui/` así:

| Archivo | Estado | Rol |
|---|---|---|
| `modules/personal/ui/personal-page.tsx` | Modificado | Listado: `DataTable` + buscador + botón "Nuevo" (link a `/personal/registrar`) + `Sheet` de detalle. Ya NO tiene el formulario de alta/edición inline. |
| `modules/personal/ui/personal-columns.tsx` | Nuevo | Definición de columnas tanstack: Cédula (ordenable), Nombres, Apellidos, Sexo, F. Nacimiento, Correo, APN, Acciones (menú: Copiar cédula, Ver detalle, Subir foto). |
| `modules/personal/ui/personal-registrar-page.tsx` | Nuevo | Página de alta en ruta propia (paridad con `personal-trabajador/registrar/` del legado). |
| `app/(app)/personal/registrar/page.tsx` | Nuevo | Wrapper delgado (R10) de la ruta anterior. |
| `modules/personal/ui/empleado-detalle-sheet.tsx` | Modificado | Se le agregó el botón "Editar" (antes solo tenía "PDF"), que abre `empleado-editar-dialog.tsx`. |
| `modules/personal/ui/empleado-editar-dialog.tsx` | Nuevo | Diálogo de edición embebido en el Sheet — paridad con el legado (`detail-info.tsx` tenía la edición en diálogos dentro del Sheet, nunca en el listado). |
| `modules/personal/ui/expediente-campos.tsx` | Nuevo | Los campos del expediente (vivienda, salud, físico, formación, contacto, antecedentes, contrato) factorizados en un componente, reutilizado tanto por el alta como por la edición (evita duplicar ~300 líneas de JSX). |
| `modules/personal/ui/catalogo-controls.tsx` | Nuevo | `CatalogSelect`/`MultiCatalogCheckbox` extraídos a archivo propio (mismo motivo). |

**Simplificación deliberada frente al legado** (documentada, no oculta): el legado
tenía **8 diálogos pequeños** de edición dentro de `detail-info.tsx` (uno por
sección: básicos, vivienda, salud, físico, académica, complementaria, antecedentes,
contrato). Aquí se implementó **un solo diálogo** con todas las secciones
(reutilizando `ExpedienteCampos`) — misma cobertura funcional, mucha menos
superficie de componentes que mantener. Si el coordinador prefiere la fragmentación
exacta en 8 diálogos, se puede hacer, pero es un costo de tiempo considerable extra
que no cambia lo que el usuario puede hacer.

**Otra brecha de alcance conocida (no resuelta):** el legado mostraba en la tabla
del listado "Estatus Contrato" (badge de color) y "F. Ingreso Organismo", porque el
listado legado traía el expediente completo anidado en cada fila. El listado nuevo
(`GET /api/v1/personal/`) solo puebla ese expediente en el detalle, no en la lista
(`EmpleadoSerializer`, decisión de la Fase 2.2 documentada en el propio backend) —
añadir esas dos columnas exigiría cambiar el contrato del backend (fuera del
alcance "solo `ui/`" de este encargo). Se documenta como brecha, no se inventó.

**Verificación de la capa `ui/` (sin el bug de abajo):**
- `npx tsc --noEmit`: 0 errores nuevos.
- `npx vitest run`: 147/147 passed (módulo `personal`: 9/9).
- Verificación visual con una captura de Playwright (login real + `/personal`):
  la tabla, el menú "Columnas", el botón "Nuevo" y el menú de acciones por fila
  (Copiar cédula / Ver detalle / Subir foto) se ven y comportan como el legado.

### 2.1. Hallazgo crítico: "Ver detalle" está roto en el backend (NO arreglado, solo documentado)

Al verificar visualmente el flujo completo (clic en "Ver detalle"), la app mostró
la pantalla de error genérica de Next.js ("Error al cargar la aplicación").
Se rastreó la causa exacta hasta el backend (sin modificar nada, solo lectura +
reproducción vía `manage.py shell`):

```
TypeError: Empleado.__init__() got an unexpected keyword argument 'perfil_fisico'
```

**Causa raíz:** `apps/personal/domain/entities/empleado.py` (dataclass `Empleado`)
**no tiene** los campos `perfil_fisico` ni `formacion_complementaria`, pero
`apps/personal/infrastructure/mappers/mapper_personal.py::construir_expediente()`
**siempre** devuelve un dict con esas dos claves, y
`apps/personal/infrastructure/repositories/repo_personal_orm.py::obtener_por_cedula()`
hace `Empleado(..., **expediente)` — con esas claves de más, revienta con
`TypeError` en cuanto el diccionario intenta pasar por el constructor.

Confirmación de que es un **bug pre-existente real**, no algo introducido por este
ajuste de `ui/`:
- El serializer de presentación (`apps/personal/presentation/serializers/personal_serializers.py`)
  **ya declara** `perfil_fisico` y `formacion_complementaria` como campos
  esperados (`PerfilFisicoLecturaSerializer`, `FormacionComplementariaLecturaSerializer`)
  — es decir, la capa de presentación fue construida asumiendo que esos campos
  existían en el dominio, pero nunca se agregaron ahí ni al DTO de aplicación
  (`apps/personal/application/dtos/personal_dtos.py`) ni al mapeo entidad→DTO
  (`apps/personal/application/use_cases/listar_personal.py::_empleado_a_dto`).
- **El mismo bug existe en `apps.pasivos`**: `apps/pasivos/domain/entities/pasivo.py`
  (`Pasivo`) y `apps/pasivos/application/dtos/pasivos_dtos.py` (`PasivoDTO`) tienen
  exactamente el mismo hueco, porque `apps/pasivos/infrastructure/repositories/repo_pasivos_orm.py`
  reutiliza la misma `construir_expediente()` de `apps.personal` y hace
  `Pasivo(..., **(expediente or {}))`. El "ver detalle" de pasivos está igual de
  roto.
- Esto explica por qué el test E2E de Playwright de una tarea anterior de esta
  sesión ("personal: ... el detalle del expediente abre") **pasó en falso**: solo
  verificaba que el título estático del Sheet ("Expediente del trabajador") fuera
  visible, lo cual ocurre igual aunque el fetch falle — nunca verificó que los
  datos realmente cargaran. Es una debilidad de esa aserción, no de este hallazgo.

**Fix propuesto (NO aplicado, requiere autorización porque toca `domain/`+`application/`,
fuera del "`ui/` únicamente" de este encargo):**

1. `apps/personal/domain/entities/empleado.py`: agregar
   `perfil_fisico: dict | None = None` y
   `formacion_complementaria: list = field(default_factory=list)` al dataclass
   `Empleado` (mismo patrón que el `perfil_salud`/`formacion_academica` ya
   existentes, una línea cada uno).
2. `apps/personal/application/dtos/personal_dtos.py`: mismos dos campos en
   `EmpleadoDTO`.
3. `apps/personal/application/use_cases/listar_personal.py::_empleado_a_dto`:
   pasar `perfil_fisico=e.perfil_fisico` y
   `formacion_complementaria=e.formacion_complementaria`.
4. Espejo idéntico en `apps/pasivos/domain/entities/pasivo.py`,
   `apps/pasivos/application/dtos/pasivos_dtos.py` y
   `apps/pasivos/application/use_cases/listar_pasivos.py::pasivo_a_dto`.

Es un fix trivial (6 líneas nuevas en 6 archivos, mismo patrón ya usado por los
campos vecinos), pero es **backend** (`domain/application`), y el encargo de este
worker es "solo `ui/`" — por eso se documenta en vez de aplicarlo. **Bloquea** que
"Ver detalle" funcione de verdad tanto en `personal` como en `pasivos` hasta que se
autorice y aplique.

---

## 3. Divergencia confirmada en `cargos` y `organización` (investigado, reconstrucción NO iniciada)

### 3.1. `cargos` (códigos de cargo)

Legado/referencia (`gestion-trabajadores/cargos/` en el repo de referencia):
- `crear-codigo/` — página propia de alta (`page.tsx` + `actions/createCode.ts` +
  `schemas/schemaCode.ts`).
- `listado-codigo/` — página propia de listado, con su propio
  `tableCodeInfo/{columns,data-table,detail-info}.tsx` + acción de actualización.

`modules/cargos/ui/cargos-page.tsx` actual (735 líneas): una sola página con todo
inline, mismo patrón que tenía `personal` antes de este ajuste.

**No se ha tocado nada de `cargos` todavía.**

### 3.2. `organización` (ubicación administrativa)

Legado/referencia (`gestion-trabajadores/ubicacion-administrativa/`) — es el módulo
más fragmentado de los tres investigados:
- `crear-ubicacion/` (crear dependencia)
- `crear-ubicacion-administrativa-direccion/` (crear dirección general)
- `actualizar-ubicacion/` con **4 schemas separados**
  (`schemaUpdateDependency`, `schemaUpdateDireccionGeneralCoord`,
  `schemaUpdateDirectionLineCoord`, `schemaUpdateCoordination`) y **4 actions**
  separadas (una por tipo de unidad organizativa: dependencia, dirección general,
  línea, coordinación).
- `listado-ubicacion-administrativa/` — listado aparte.

`modules/organizacion/ui/organizacion-page.tsx` actual (755 líneas): una sola
página con todo inline.

**No se ha tocado nada de `organización` todavía.** Este módulo va a requerir más
decisiones de diseño que personal/cargos porque el legado separa 4 tipos de unidad
organizativa en flujos independientes — antes de reconstruirlo conviene confirmar
si el coordinador quiere esa misma fragmentación en 4 sub-flujos o está bien
mantenerlos como pestañas/secciones de una sola página de administración (mismo
`DataTable`+dropdown, pero sin 4 rutas de creación separadas). Se preguntará con
`ask` si hace falta al retomar.

---

## 4. Patrón general confirmado (aplica a los 9 módulos restantes, sin investigar aún)

Del legado (repo de referencia) se confirma un patrón consistente:

```
<modulo>/
├── <crear-x>/            → página de alta (ruta propia)
├── <consultar|listado-x>/
│   └── table<X>/
│       ├── columns.tsx        → definición tanstack, incluye columna "Acciones"
│       ├── data-table.tsx     → (ahora: shared/ui/components/data-table.tsx)
│       ├── data-table-column-header.tsx → (ahora: shared)
│       └── detail-info.tsx    → Sheet de detalle + diálogos de edición embebidos
└── (sub-flujos anidados si el dominio lo pide, ej. familiares dentro de personal)
```

Módulos aún sin investigar contra el legado/referencia: `familiares`,
`movimientos`, `pasivos`, `carnetización`, `autogestión`, `reportes`, `catálogos`,
`identidad/usuarios`, `auth`. Se investigarán uno a uno antes de reconstruir cada
uno, siguiendo la misma metodología usada en personal/cargos/organización (leer
legado + referencia, comparar con lo nuevo, listar divergencias concretas).

---

## 5. Servidores levantados (NO TOCAR — orden del coordinador)

Siguen corriendo desde una tarea anterior de esta sesión, sin detenerse:

- **Backend Django**: `http://localhost:8001` (contra `NUEVABD-GATH` real).
- **Frontend NextJS**: `http://localhost:3001`.
- Credenciales de prueba: `usuario.prueba.e2e@conatel.gob.ve` /
  `E2eSmokeTest!2026` (rol ADMINISTRADOR, cédula sintética `99999999`, dejada
  intencionalmente en la BD para pruebas del coordinador).

El frontend recompila solo (Turbopack, hot reload) con los cambios de archivo ya
escritos en disco — es decir, **el coordinador puede entrar ahora mismo a
`http://localhost:3001/personal` y ver el nuevo listado con `DataTable`+dropdown**,
con la salvedad de que "Ver detalle" fallará por el bug de la sección 2.1 hasta que
se autorice el fix.

Queda un archivo suelto de diagnóstico sin commitear en
`NextJS/visual_check.js` (script de Playwright que tomó las capturas de
verificación) — no se tocó/borró para no “tocar código” mientras dura la pausa;
se puede borrar en cuanto se retome.

---

## 6. Estado exacto del árbol de git ahora mismo

```
Commiteado (commit 5330131):
  NextJS/src/shared/ui/components/data-table.tsx                (nuevo)
  NextJS/src/shared/ui/components/data-table-column-header.tsx  (nuevo)

Sin commitear (working tree, personal module):
  M  NextJS/src/modules/personal/ui/empleado-detalle-sheet.tsx
  M  NextJS/src/modules/personal/ui/personal-page.tsx
  ?? NextJS/src/app/(app)/personal/registrar/
  ?? NextJS/src/modules/personal/ui/catalogo-controls.tsx
  ?? NextJS/src/modules/personal/ui/empleado-editar-dialog.tsx
  ?? NextJS/src/modules/personal/ui/expediente-campos.tsx
  ?? NextJS/src/modules/personal/ui/personal-columns.tsx
  ?? NextJS/src/modules/personal/ui/personal-registrar-page.tsx

Sin commitear, no relacionado con el código de la app:
  ?? NextJS/visual_check.js   (script de diagnóstico propio, no es parte de la app)
```

No se tocó nada de `cargos`, `organización` ni de los otros 9 módulos.
No se tocó el backend (los 6 archivos del fix de la sección 2.1 siguen sin editar).

---

## 7. Preguntas para el coordinador antes de retomar

1. **¿Autorizo el fix de `perfil_fisico`/`formacion_complementaria`** (sección
   2.1, 6 archivos, ~6 líneas, mismo patrón que campos vecinos ya existentes) para
   desbloquear "Ver detalle" en personal y pasivos? Sin esto, el módulo `personal`
   reconstruido no puede darse por terminado — la función central (ver expediente)
   está rota.
2. **¿La simplificación de 8 diálogos de edición del legado a 1 solo diálogo
   consolidado** (sección 2, `empleado-editar-dialog.tsx`) es aceptable, o se
   requiere la fragmentación exacta en 8 diálogos pequeños como el legado?
3. **Para `organización`** (sección 3.2): ¿mantener la fragmentación exacta del
   legado en 4 flujos de creación/edición separados (dependencia, dirección
   general, línea, coordinación), o es aceptable una sola página de administración
   con pestañas/secciones para los 4 tipos, reutilizando el mismo `DataTable`+
   dropdown pero sin 4 rutas de alta independientes?
4. **¿Continúo en este mismo worker/tarea** con cargos → organización → el resto
   de los 9, con commits atómicos y avisos de progreso como ya se venía haciendo,
   o el coordinador prefiere repartir los módulos restantes entre varios workers en
   paralelo dado el tamaño del trabajo?
