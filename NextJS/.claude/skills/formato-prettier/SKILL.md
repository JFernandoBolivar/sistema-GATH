---
name: formato-prettier
description: Formato de código con Prettier en el frontend Next.js de GATH. Config, integración con ESLint (`eslint-config-prettier` al final, sin desactivar la frontera de importación), cuándo correr format vs format:check, y qué hacer si un archivo nuevo no respeta el estilo.
---

# Skill de formato con Prettier

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Stack verificado en `NextJS/package.json`: Next.js **16.1.3** (App Router) + React **19.2.3**, TypeScript **5.8.3**, ESLint **9** con `eslint-config-next` **16.1.3**, Tailwind **v4**, Zod **3.25.56**.

Regla del plan que gobierna esta skill, citada literal (§II.7, tabla R1–R16):

> | **R14** | `eslint-config-prettier` se ubica como último elemento de la configuración; `format:check` en CI | CI Prettier |

Y en el resumen de reglas del plan: «**R14:** `eslint-config-prettier` al final de la configuración; 0 diffs en `format:check`.»

**Estado real hoy: pendiente, nada de esto está instalado.** Verificado en el repo — no existe `NextJS/.prettierrc*` ni `NextJS/.prettierignore`; ni `prettier` ni `eslint-config-prettier` figuran en `NextJS/package.json`; los únicos scripts declarados son `dev`, `build`, `start`, `lint` y `lint:any` (no hay `format`, `format:check` ni `typecheck`); y `NextJS/eslint.config.mjs` no importa `prettierConfig`. Esta skill describe el objetivo de la tarea **F1.5b** del plan, no un estado alcanzado: al aplicarla, instala primero.

Gestor de paquetes: el plan unifica en **pnpm** (**F1.5**), pero hoy conviven `package-lock.json` y `pnpm-lock.yaml` en `NextJS/` y `package.json` no declara `packageManager`. Los comandos `pnpm …` de esta skill son el objetivo; mientras F1.5 no se ejecute, su equivalente `npm run …` es válido.

Esta skill fue heredada de otro proyecto y **reconciliada** para GATH; el registro literal de adaptaciones está en `PLAN_RECONSTRUCCION_ONION.v1.md` **§0.6.2**, fila `formato-prettier`: *«Adoptada: Regla R14»* — el criterio técnico se conserva íntegro. Ver también [[arquitecto-scream-feature-onion]] (frontera de importación de `modules/`) y [[despliegue-docker-django-nextjs]] (puerta de CI).

---

Prettier es la única fuente de verdad del **formato** (comillas, punto y coma, ancho de línea,
comas finales). ESLint sigue siendo la fuente de verdad de **arquitectura** (`boundaries/*` — reglas
**R1**–**R3** del plan) y de **calidad de código** (`no-explicit-any`, orden de imports y alias `@/`
según **R6**, `kebab-case` según **R9**, reglas de React/Next). Los dos
conviven porque `eslint-config-prettier` apaga, al final de `eslint.config.mjs`, cualquier regla de
ESLint que pudiera chocar con el formato.

---

## 1. Setup (**pendiente** — tarea F1.5b)

Ninguna de las dos dependencias está instalada en GATH todavía:

```bash
pnpm add -D prettier eslint-config-prettier   # npm i -D … mientras no se unifique en pnpm (F1.5)
```

### `.prettierrc.json` (raíz de `NextJS/`, aún no existe)

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

### `.prettierignore`

```
node_modules
.next
pnpm-lock.yaml
package-lock.json
tsconfig.tsbuildinfo
test-results
e2e/.auth
storybook-static
```

`e2e/.auth`, `storybook-static` y `test-results` corresponden a herramientas que aún no existen en
GATH (F1.5c/F1.5d): mantener las entradas es inofensivo, pero no las cites como algo ya configurado.
`.prettierignore` **no** es un control de secretos: los `.env` salen del índice de git por **F0.3**
(**CRIT-03**, **R15**), no por ignorarlos aquí.

### `eslint.config.mjs` — `prettierConfig` va al final del array

Estado real: `NextJS/eslint.config.mjs` exporta hoy un array plano — `...nextCoreWebVitals`,
`...nextTypescript`, un bloque de `rules` y un bloque `ignores` — **sin** `eslint-plugin-boundaries`
y **sin** `prettierConfig`. El array objetivo, tras F1.5 y F1.5b:

```js
import prettierConfig from "eslint-config-prettier";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  architectureBoundaries, // frontera de importación de modules/: R1, R2, R3
  sharedIsolation,        // aislamiento de shared/
  codeStyle,              // no-explicit-any, imports/alias @/, kebab-case
  prettierConfig,         // ← siempre el último: apaga conflictos de estilo, no de arquitectura
  { ignores: [...] },
];
```

**Regla R14:** si se agrega un bloque nuevo a `eslintConfig` (otra regla de arquitectura, otro
plugin), `prettierConfig` se queda al final. Si se mueve antes de un bloque que define reglas de
estilo, ese bloque puede volver a chocar con Prettier sin que nadie lo note hasta el próximo
`format:check`.

**Al final no significa «que anule la frontera de importación».** El plan crea `modules/[modulo]/`
(§II.4.1) con la frontera vigilada por `eslint-plugin-boundaries` **desde el primer día** (F1.5:
**R1** `domain/` no importa hacia afuera, **R2** `application/` solo importa de `domain/`, **R3**
`ui/` no importa de `infrastructure/`, más el aislamiento de `shared/`). `eslint-config-prettier`
solo apaga reglas de **formato**; nunca debe silenciar `boundaries/*`. Comprobación al colocarlo:
un import ilegal a propósito (algo de `ui/` importando de `infrastructure/`) debe seguir fallando en
`pnpm lint` después del cambio. Si deja de fallar, la configuración está mal, no el import.

---

## 2. Scripts (**pendientes** — hay que agregarlos a `NextJS/package.json`)

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- `pnpm format` — reescribe archivos. Úsalo en local antes de un commit grande, o una sola vez al
  adoptar Prettier en un repo que no lo tenía (diff grande, pero solo de formato).
- `pnpm format:check` — no modifica nada, solo falla si algo no está formateado. Es el **primer paso**
  del pipeline de CI del plan (**F1.6**): `format:check` → `eslint` → `tsc --noEmit` → `test:unit`
  → `build`. Ese pipeline y el stage `tester` del Dockerfile están **pendientes**: hoy no hay
  configuración de CI en el repo y `NextJS/nextjs.dockerfile` es de una sola etapa (`FROM node`),
  así que por ahora la verificación es local y manual.

---

## 3. Flujo de trabajo

1. Escribe el código como te resulte natural — no formatees a mano.
2. Antes de terminar una tarea, corre `pnpm format` (o deja que el editor lo haga on-save con la
   extensión de Prettier).
3. Si tocaste `eslint.config.mjs` o cualquier regla de estilo, corre `pnpm format:check` para
   confirmar que no quedó nada sin formatear antes de dar la tarea por completa.
4. Si `eslint --fix` y `prettier --write` se corren en el mismo archivo, el orden que evita
   pisarse es: primero `eslint --fix` (reordena imports, agrega `import type`), después
   `prettier --write` (ajusta espacios/comillas sobre el resultado ya reordenado).

```bash
npx eslint . --fix
npx prettier --write .
pnpm format:check   # debe salir "All matched files use Prettier code style!"
```

---

## 4. Qué NO tocar con Prettier

- Archivos en `.prettierignore` (lockfiles, `.next/`, artefactos de build).
- No agregar reglas de estilo manuales a `eslint.config.mjs` que dupliquen lo que ya hace Prettier
  (ancho de línea, comillas) — eso es exactamente lo que `eslint-config-prettier` existe para evitar.
- No usar `// prettier-ignore` para "arreglar" algo que en realidad es un error de lint real
  (`boundaries/dependencies`, `import/order`) — esos no los resuelve Prettier, hay que corregir el
  import de verdad.

---

## 5. Pre-flight checks

- [ ] ¿`pnpm format:check` pasa en 0 diffs?
- [ ] ¿`prettierConfig` sigue siendo el último elemento del array en `eslint.config.mjs`?
- [ ] ¿Sigue fallando `pnpm lint` ante un import que cruza la frontera de `modules/` (R1–R3)? Si
      `prettierConfig` apagó esas reglas, se movió mal.
- [ ] ¿Los archivos nuevos (`*.stories.tsx`, `*.test.ts`, configs) están en `.prettierignore` solo
      si de verdad no deben formatearse — o si no, ya pasaron por `pnpm format`?
- [ ] ¿`npx tsc --noEmit` (no hay script `typecheck` en GATH) y `pnpm build` siguen en verde después
      de un `pnpm format` masivo? (Prettier no debería romper nada — solo espacios y comillas — pero
      se verifica igual).
