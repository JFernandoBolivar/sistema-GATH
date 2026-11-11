# AUD3 PASO 2 — Arquitectura del frontend, módulo por módulo

**Skills usadas:** `arquitecto-scream-feature-onion` (versión del proyecto en
`NextJS/.claude/skills/`), `patrones-implementacion-frontend`,
`formato-prettier`.
**Método:** recorrido de los 19 módulos de `src/modules/`, inventario de capas y
piezas, `grep` de imports entre capas y módulos, `tsc`, `eslint` y `vitest`.

## Resumen

- Los 19 módulos siguen la estructura `domain/application/infrastructure/ui`
  (con las excepciones de 02-13) y los nombres de la skill (`repo-*`,
  `*-api.ts`, `*-actions.ts`, `mapper-*`, `schema-*`, `*-page.tsx`).
- **La frontera Onion no está implementada en este proyecto** (02-01): el
  `eslint.config.mjs` real tiene 49 líneas, solo `eslint-config-next` y reglas de
  TypeScript/hooks; no hay `import/no-restricted-paths` ni
  `shared/arquitectura/invariantes.test.ts`. La verificación fue manual.
- Tras las correcciones de este paso, **ningún archivo de `application/` importa
  `infrastructure/`** y **ninguna página o layout de `app/` importa
  `infrastructure/http` ni `infrastructure/repositories`**.
- `domain/` no importa React, Next, zod ni formularios (0 casos).
- Sin `any` ni `console.log` en `src` fuera de pruebas.

## Tabla por módulo

| Módulo | domain | application | http | actions | mappers | ports | ui | pruebas | Estado |
| ------ | ------ | ----------- | ---- | ------- | ------- | ----- | -- | ------- | ------ |
| `auditoria` | 5 | 1 | 2 | 1 | 1 | 1 | 6 | 3 | OK; `ui/services` llama al http de descargas (02-12) |
| `auth` | 3 | 11 | 1 | 1 | 1 | 1 | 14 | 10 | OK |
| `autogestion` | 25 | 8 | 2 | 2 | 2 | 3 | 66 | 27 | OK; tipos de censo corregidos (02-05) |
| `carga-masiva` | 1 | **0** | 1 | 1 | 0 | **0** | 8 | 1 | Módulo incompleto (02-13) |
| `cargos` | 6 | 8 | 1 | 1 | 1 | 1 | 10 | 4 | OK; `MotivoSelect` y schema reutilizados por `movimientos`/`pasivos` (02-12) |
| `carnetizacion` | 9 | 14 | 3 | 3 | 1 | 1 | 51 | 14 | **corregido**: el cliente de eventos salió de `application` (02-04) |
| `catalogos` | 3 | 5 | 1 | 1 | 1 | 1 | 6 | 5 | OK |
| `configuracion` | 6 | 7 | 5 | 5 | 2 | 2 | 23 | 11 | OK |
| `familiares` | 6 | 7 | 1 | 2 | 1 | 3 | 19 | 4 | OK |
| `fe-de-vida` | 12 | 12 | 1 | 2 | 2 | 2 | 72 | 34 | OK; reutiliza formato/editor/guías de `autogestion` (02-12) |
| `identidad` | 6 | 7 | 1 | 1 | 2 | 2 | 19 | 11 | OK |
| `movimientos` | 6 | 5 | 2 | 1 | 1 | 1 | 20 | 7 | OK |
| `notificaciones` | 2 | 3 | 1 | 1 | 1 | 1 | 11 | 4 | OK; contador usado por 4 sidebars (02-12) |
| `organizacion` | 3 | 4 | 1 | 1 | 1 | 1 | 16 | 3 | OK |
| `pasivos` | 5 | 6 | 1 | 1 | 1 | 3 | 15 | 9 | OK; reutiliza pasos de `personal` (02-12) |
| `personal` | 6 | 8 | 2 | 2 | 1 | 3 | 57 | 22 | OK; caché de catálogos `"use client"` en infrastructure (02-10) |
| `puntocuenta` | 2 | **0** | 1 | 1 | 0 | **0** | 2 | 1 | Módulo incompleto (02-13) |
| `reportes` | 4 | 5 | 1 | 1 | 1 | 1 | 25 | 7 | OK |
| `retroalimentacion` | **0** | **0** | **0** | **0** | **0** | **0** | 10 | 1 | Solo UI; consume acciones de `catalogos` (02-13) |

## Hallazgos y correcciones

### 02-01 — La frontera Onion no está implementada (ALTA, a decisión)

`NextJS/eslint.config.mjs` no tiene `import/no-restricted-paths`: no hay ninguna
regla que impida `application → infrastructure` ni `app → http/repositories`.
Tampoco existe `shared/arquitectura/invariantes.test.ts` (el test que en la
versión canónica de la skill detecta `fetch` en componentes cliente). La
frontera se sostiene hoy por revisión manual.

Añadirla exige `eslint-plugin-import` (dependencia) y declarar las zonas de los
19 módulos; con las correcciones 02-04/02-05 el árbol ya pasa las dos reglas
principales, pero las zonas de todos los módulos deben escribirse una vez.
Recomendación: tarea dedicada «frontera de importación» con el plugin, las zonas
y `pnpm lint` en CI.

### 02-02 — Dos árboles de componentes en uso (ALTA, a decisión)

| Árbol | Archivos | Imports `from` |
| ----- | -------- | -------------- |
| `src/components/` | 76 | 612 `@/components/` + 78 `@/components/layout/` |
| `src/shared/ui/components/` | 80 | 677 `@/shared/ui/components/` |
| `src/lib/` | 10 | 100 `@/lib/` |
| `src/shared/lib/` | 19 | 95 `@/shared/lib/` |

Las primitivas shadcn están duplicadas (botón, card, select…) y pueden
divergir. Es el `MED-10` / `F2.9` del plan del proyecto. Unificar es un cambio
masivo de imports sin cambio funcional; va en una tarea aparte con `tsc`,
`eslint` y `vitest` completos.

### 02-03 — Tipos compartidos dentro de `app/` (MEDIA, documentado)

`src/app/types/types.ts` (13 KB) lo importan módulos (`autogestion` http,
actions y schema), `src/shared/components/contrato-inline-form.tsx` y `src/lib/`.
`app/` debe ser rutas; el archivo pertenece a `shared/types/`. Se mueve en la
misma tarea de unificación que 02-02 porque comparte importadores.

### 02-04 — `application` con el cliente HTTP (MEDIA, **corregido**)

`src/modules/carnetizacion/application/use-cases/gestionar-eventos.ts` era en
realidad el cliente HTTP de eventos: importaba `apiClient` y hacía `get/post`.
Se movió a `src/modules/carnetizacion/infrastructure/http/eventos-api.ts`
(nombre de la convención) y se actualizaron:

- `infrastructure/actions/eventos-actions.ts` → `../http/eventos-api`;
- la prueba, movida a `infrastructure/http/eventos-api.test.ts` (4 pruebas).

`application/` de carnetización queda con casos de uso puros (no queda ningún
`apiClient` en `application` de todo el proyecto).

### 02-05 — Páginas con tipos del transporte (MEDIA, **corregido**)

`src/app/(app)/autogestion/censo/page.tsx` y
`src/app/(app)/personal/censo/respuestas/page.tsx` importaban
`DatosViviendaPayload` y `CensoEmpleadoItem` de
`modules/autogestion/infrastructure/http/autogestion-api`.

- Se añadieron a `modules/autogestion/domain/entities/censo.ts` (que ya existía
  para el censo) los tipos `DatosViviendaCenso`, `ViviendaCenso`, `CargoCenso`,
  `PreguntaRespondidaCenso` y `CensoEmpleado`.
- El cliente HTTP los importa y mantiene los alias `DatosViviendaPayload` /
  `CensoEmpleadoItem` para no romper a los consumidores internos.
- Las dos páginas importan ahora del dominio.

### 02-06 — `"use server"` en un layout (BAJA, **corregido**)

`src/app/(app)/layout.tsx` empezaba con `"use server"` siendo un Server
Component async con JSX. La directiva se retiró; el layout sigue siendo de
servidor (`auth()` + JSX) y no exporta acciones.

### 02-07 — Acciones sin validación zod (MEDIA, documentado)

16 de 31 archivos de acciones no llaman a `safeParse`/`parse`. La mayoría son
**lecturas** (`get*Action` para SWR), que reciben ids o filtros opcionales, y
escrituras con `FormData` validado en el caso de uso. Las escrituras de
formulario sí validan con el schema de `ui/schema` o `domain/schemas` (por
ejemplo `personal`, `pasivos`, `configuracion`). Completar las restantes exige
revisar una por una para no cambiar contratos; queda anotado.

### 02-08 — Acciones de eventos que lanzan (MEDIA, documentado)

`carnetizacion/infrastructure/actions/eventos-actions.ts` lanza en casi todas
sus acciones (20 `throw`) en vez de devolver `Resultado<T>`. Es el módulo O45-B
más nuevo y no sigue la convención de las demás acciones. Nota: los `throw` de
las acciones de lectura son intencionales (SWR necesita el error); el problema
son las de escritura. Convertirlas requiere sus pruebas de eventos.

### 02-09 — S-06 y variables de entorno (verificado)

Los 9 componentes cliente con `fetch(` apuntan a rutas del **mismo origen**
(`/api/puntocuenta/…`, `/api/fe-de-vida/…`, `/api/carga-masiva/…`,
`/api/movimientos/…`), es decir, a los route handlers proxy de Next, no a
Django. `process.env` en cliente solo aparece como `NODE_ENV` (error boundary,
PWA y censo). No hay secretos ni URL de la API en el bundle.

### 02-10 — Caché de catálogos con `"use client"` en infrastructure (BAJA)

`personal/infrastructure/cache/catalogos-expediente-cache.ts` es una caché en
memoria del navegador (deduplica promesas y conserva los catálogos entre
pantallas); necesita `"use client"`. Es un adaptador de cliente legítimo, pero
la excepción se documenta porque `infrastructure/` no suele llevar la directiva.

### 02-11 — Acciones compartidas dentro de `shared/ui` (BAJA)

`shared/ui/guias/guias-actions.ts` es un archivo `"use server"` dentro de
`shared/ui/`. Por convención va en `shared/infrastructure/actions/`. Moverlo
arrastra el hook `use-guia.ts`, el barrel `index.ts` y sus pruebas; se deja para
la limpieza de `shared/`.

### 02-12 — Imports entre módulos (BAJA, documentado)

Los casos reales, todos por necesidad:

- `notificaciones/ui/contador-menu-notificaciones` en los 4 sidebars;
- `pasivos` reutiliza los pasos de registro de `personal` (evita duplicar el
  asistente de 7 pasos);
- `movimientos` reutiliza `MotivoSelect` y `schema-asignar-cargo` de `cargos`;
- `fe-de-vida` reutiliza `formatearValor`, `EditorEntidad` y las guías de
  `autogestion`;
- `auditoria`/`movimientos` tienen `ui/services/*` que llaman al http de
  descargas del propio módulo.

La skill pide que lo reutilizable por 2+ módulos viva en `shared/`. Mover estas
piezas es un refactor con pruebas de UI; se anota como limpieza posterior.

### 02-13 — Módulos incompletos (BAJA, documentado)

- `carga-masiva` y `puntocuenta`: `ui → actions → http`, sin `application/` ni
  `domain/ports/`.
- `retroalimentacion`: solo `ui/` (7 schemas y una vista) y consume las acciones
  de `catalogos`.

La skill admite módulos incompletos y pide que **lo nuevo** se escriba con el
patrón completo; no se reescriben.

### 02-14 — Ubicación de los schemas zod (INFO)

73 schemas en `ui/schema/` (lo que pide la skill de GATH: solo el formulario) y
17 en `shared/schemas/employees/{register,update}` porque los comparten
`personal` y `pasivos` (regla «2+ módulos → shared»). Ninguno en
`domain/schemas/`. Correcto para este proyecto; no requiere cambios.

### 02-15 — Cobertura de pruebas (INFO)

210 archivos de prueba; los 19 módulos tienen al menos uno. Los más flojos:
`carga-masiva` (1), `puntocuenta` (1), `retroalimentacion` (1) y `auditoria`
(3 para 6 archivos de UI). Se cubre en el PASO 6.

### 02-16 — Prettier (MEDIA, a decisión)

`npx prettier --check "src/**/*.{ts,tsx}"` falla en **1192 archivos**. Hay
configuración y `format:check`, pero el árbol nunca se formateó. Un `--write`
global produce un diff enorme; va en un commit exclusivo (`style: prettier`) con
`format:check` en CI.

### 02-17 — Reglas de TypeScript (INFO, verificado)

Sin `any` explícitos ni `console.log` en `src` fuera de pruebas. Los alias
`@/*` son los únicos usados. `"use client"` no aparece en `domain/` ni en
`application/`; solo en `ui/` y en la caché de 02-10.

### 02-18 — Route handlers (INFO, verificado)

Los 14 `app/api/**/route.ts` importan `shared/infrastructure/http` a propósito:
son los proxies de descarga que conservan el código de error del backend (F2-06)
y no páginas. La restricción de la skill aplica a `page.tsx`/`layout.tsx`, que
ya no importan el transporte.

## Verificación de este paso

- `npx tsc --noEmit`: **0 errores**.
- `npx eslint src --quiet`: **0 errores**.
- `npx vitest run src/modules/autogestion`: **27 archivos / 158 pruebas**.
- `npx vitest run src/modules/carnetizacion/infrastructure/http/eventos-api.test.ts`:
  **4 pruebas**.
- La batería completa (`vitest`, `next build`) se repite al cerrar la FASE 2.
