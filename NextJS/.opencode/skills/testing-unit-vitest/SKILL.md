---
name: testing-unit-vitest
description: Tests unitarios y de componentes con Vitest + React Testing Library + MSW para el frontend Next.js de GATH. Qué se puede testear y qué no en Next.js 16, la regla R11 de ubicación (test junto al archivo, en el mismo commit), y plantillas para casos de uso, schemas Zod, componentes y el cliente HTTP (`apiClient`) contra el sobre C-1.
---

# Skill de tests unitarios (Vitest + RTL + MSW)

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Stack verificado en `NextJS/package.json`: Next.js **16.1.3** (App Router), React **19.2.3**, `next-auth` **5.0.0-beta.25**, Zod **3.25.56** (la fase **F1.9** lo asciende a v4), SWR **2.3.8**, TypeScript **5.8.3**, gestor **pnpm**.
Contratos y reglas que gobiernan esta skill: **C-1** (sobre de respuesta único `{status, message, data}` — los handlers de MSW lo devuelven, sin excepción), **C-2** (sesión por cookies `HttpOnly` `dj_access`/`dj_refresh`; nunca un token en `localStorage`), **C-3**/**R16** (autorización por códigos `[modulo].[accion]` vía `puede()`, jamás por nombre de rol) y **R11** (§3 de esta skill).
Esta skill fue heredada de otro proyecto y **reconciliada** para GATH; el registro literal de la decisión está en `PLAN_RECONSTRUCCION_ONION.v1.md` **§0.6.2** (*«Adoptada íntegramente: Regla R11»*), con la pirámide de calidad en §II.9 y el checklist de 18 pasos en §II.8 (paso 17 = esta skill).

> **Estado real, verificado — no lo tergiverses:** el frontend de GATH hoy tiene **0 tests automatizados** (§II.1 del plan). `vitest`, `msw`, `@testing-library/*` y `jsdom` **no están declarados** en `NextJS/package.json`, y no existen `vitest.config.mts` ni `vitest.setup.ts`. Instalarlos es la tarea **F1.5c** (Storybook es **F1.5d**), pendiente. Todo lo que esta skill describe como "ya instalado" o como "ejemplo real" pertenece al proyecto de origen: las rutas `modules/alianza/…`, `modules/perfil/…`, `shared/ui/components/field.test.tsx` y `shared/infrastructure/http/fetcher-api.test.ts` **no existen en este repo** — son plantillas a replicar sobre el dominio de GATH (`personal`, `cargos`, `familiares`, `movimientos`, `organizacion`, `catalogos`, `identidad`, `reportes`, `carnetizacion`, `autogestion`), no archivos que puedas abrir. Verifica antes de citar.

Del otro lado del contrato, el backend Django prueba lo equivalente con **pytest + pytest-django** (**D-12**) y repositorios en memoria: ver [[testing-backend-django]]. La estructura modular que estos tests recorren la define [[arquitecto-scream-feature-onion]].

---

Esta skill complementa [[testing-e2e-playwright]]. Playwright cubre flujos completos con backend
real; esta skill cubre lógica aislada — rápida, sin red, sin navegador real.

---

## 1. Qué SÍ y qué NO testear aquí

La documentación de Next.js empaquetada en este repo
(`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`) advierte que **Vitest no
soporta Server Components async**. En este proyecto eso se traduce en:

| Capa                                                        | ¿Vitest?     | Por qué                                                                                                                         |
| ----------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `application/use-cases/*.ts`                                | ✅           | Funciones puras, reciben el repo por parámetro (inyección)                                                                      |
| `ui/schema/schema-*.ts` (Zod)                               | ✅           | Validación pura, sin red ni DOM                                                                                                 |
| Componentes `"use client"` presentacionales                 | ✅ (RTL)     | Renderizado + props, sin Server Actions                                                                                         |
| `shared/infrastructure/http/fetcher-api.ts`                 | ✅ (con MSW) | Es la única pieza de red que vale la pena aislar — ver §4                                                                       |
| **Server Actions** (`infrastructure/actions/*.ts`)          | ❌           | Usan `cookies()` de `next/headers`, solo válido dentro del scope de request de Next — truena fuera de él. Van a Playwright E2E. |
| **Server Components async** (`app/**/page.tsx` con `await`) | ❌           | No soportado por Vitest — Playwright E2E.                                                                                       |

---

## 2. Setup (tarea F1.5c — pendiente en GATH)

> En GATH este setup **no existe todavía**: es la fase **F1.5c** del plan. El bloque siguiente es el
> comando de instalación a ejecutar en esa fase, no una descripción del estado actual. No ejecutes
> `pnpm add` por iniciativa propia dentro de una tarea de otro alcance.

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom vite-tsconfig-paths msw
```

`vitest.config.mts` usa `projects` (en el proyecto de origen lo agregó también el instalador de
Storybook — en GATH, Storybook es la tarea **F1.5d**, ver [[storybook-chromatic]]): el proyecto
`"unit"` es el que le corresponde a esta skill.

```ts
{
  extends: true,
  test: {
    name: "unit",
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
}
```

`vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

### Scripts

```json
{
  "test:unit": "vitest run --project=unit",
  "test:unit:watch": "vitest --project=unit"
}
```

**Regla:** siempre `--project=unit`. Sin el filtro, `vitest run` intenta correr también el proyecto
`"storybook"` (tests de stories en Chromium headless vía `@vitest/browser-playwright`), que es
lento y no pertenece a esta skill — ver [[storybook-chromatic]] (**R12**).

---

## 3. Convención de ubicación — **Regla R11**

> **R11** (Apéndice A del plan, verbatim): *«Todo caso de uso, schema Zod y componente
> presentacional lleva su `.test.ts(x)` en el mismo commit»* — verificado por **CI (cobertura
> Vitest)**.

Dos exigencias inseparables, y ninguna de las dos es negociable:

1. **Ubicación:** el test vive **junto al archivo que prueba** — mismo directorio, mismo nombre base,
   sufijo `.test.ts` / `.test.tsx`. No hay carpeta `__tests__/`, ni `tests/` paralela, ni espejo de la
   estructura de módulos.
2. **Momento:** en el **mismo commit** que el código que prueba. Un commit que agrega un caso de uso,
   un schema Zod o un componente presentacional de `shared/ui/components/` **sin** su `.test.ts(x)`
   está incompleto: no se separa "primero el código, el test después".

```
modules/personal/application/use-cases/create-personal.ts
modules/personal/application/use-cases/create-personal.test.ts

modules/personal/ui/schema/schema-personal.ts
modules/personal/ui/schema/schema-personal.test.ts

shared/ui/components/input-form.tsx
shared/ui/components/input-form.test.tsx
```

R11 es el paso **17** del checklist de 18 pasos por módulo (§II.8 del plan). Su hermano del paso 18
es E2E + a11y: [[testing-e2e-playwright]].

---

## 4. Plantillas

### Caso de uso puro — repo fake inyectado

```ts
// modules/[modulo]/application/use-cases/[accion]-[nombre].test.ts
import { describe, expect, it, vi } from "vitest";

import type { Repo[Nombre] } from "../../domain/ports/repo-[nombre]";
import { [accion][Nombre] } from "./[accion]-[nombre]";

function fakeRepo(overrides: Partial<Repo[Nombre]> = {}): Repo[Nombre] {
  return { getAll: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), ...overrides };
}

describe("[accion][Nombre]", () => {
  it("delega en repo.[metodo] con los datos recibidos", async () => {
    const repo = fakeRepo({ create: vi.fn().mockResolvedValue({ id: "1" }) });
    const result = await [accion][Nombre](repo, { /* datos */ });
    expect(repo.create).toHaveBeenCalledWith({ /* datos */ });
    expect(result).toEqual({ id: "1" });
  });
});
```

Ver ejemplo real: `modules/alianza/application/use-cases/create-alianza.test.ts`.

### Schema Zod — casos válidos e inválidos, no solo "required"

```ts
import { describe, expect, it } from "vitest";
import { [nombre]FormSchema } from "./schema-[nombre]";

describe("[nombre]FormSchema", () => {
  it("acepta datos válidos", () => {
    expect([nombre]FormSchema.safeParse({ /* válido */ }).success).toBe(true);
  });

  it("rechaza un [campo] con formato inválido", () => {
    expect([nombre]FormSchema.safeParse({ /* inválido */ }).success).toBe(false);
  });
});
```

Prioriza casos de negocio reales sobre el regex en sí. En GATH eso significa las invariantes del
dominio de talento humano: formato de cédula y RIF venezolanos, teléfono, fechas de ingreso/egreso
coherentes, uniones condicionales por tipo de personal (activo vs. pasivo/jubilado) o por parentesco
en `familiares`.

Los regex y mensajes **no se escriben en el schema**: se importan de `shared/validation/`
(`regex.ts`, `messages.ts`, `sanitize.ts`) — regla de cero hardcodeo de
[[validacion-input-protegido]], creada en la tarea **F2.12**. Un test de schema que reimplemente el
regex a mano está probando otra cosa que la que corre en producción.

### Componente presentacional — React Testing Library

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { [Componente] } from "./[componente]";

describe("[Componente]", () => {
  it("no muestra X cuando la prop no se pasa", () => {
    render(<[Componente] />);
    expect(screen.queryByText("X")).not.toBeInTheDocument();
  });

  it("muestra X cuando la prop se pasa", () => {
    render(<[Componente] prop="X" />);
    expect(screen.getByText("X")).toBeInTheDocument();
  });
});
```

Ver ejemplo real: `shared/ui/components/field.test.tsx`.

### Cliente HTTP con MSW — el test que de verdad vale la pena

Todas las llamadas HTTP del repo pasan por `shared/infrastructure/http/fetcher-api.ts` (el
`apiClient`; hoy en GATH todavía vive como `src/lib/api-client.ts` y se reescribe en **F2.10**), que
usa `cookies()` de `next/headers` — hay que mockearlo, junto con el módulo de auth (porque
`shared/infrastructure/http/errors.ts` importa `signOut` para `handleSessionExpired`, y eso arrastra
`next-auth` → `next/server`, que no resuelve fuera del runtime de Next).

**Dos cosas que en GATH cambian respecto a la versión heredada, y ambas son verificables:**

- **El alias es `#/auth`, no `@/auth`.** En `NextJS/tsconfig.json`, `@/*` apunta a `./src/*` y `#/*`
  a la raíz del proyecto; `auth.ts` está en la raíz. Todo el repo importa `from "#/auth"`. Un
  `vi.mock("@/auth", …)` no interceptaría nada.
- **La sesión son cookies `HttpOnly` reales (C-2):** `dj_access` (15 min) y `dj_refresh` (8 h). El
  store falso se puebla con **esos** nombres. Nunca simules un token en `localStorage` ni en un
  header `Authorization` fijado desde el cliente: sería enseñar un patrón que en GATH no existe.

```ts
vi.mock("#/auth", () => ({ signOut: vi.fn(), auth: vi.fn() }));
cookieStore.set("dj_access", "token-de-prueba");   // C-2, no localStorage
cookieStore.set("dj_refresh", "refresh-de-prueba");
```

**Los handlers devuelven el sobre C-1, no formas ad hoc.** Todo endpoint de GATH responde
`{status: "success" | "error", message, data}` (tipado en `shared/types/api-respose.ts`), así que un
handler que devuelva el recurso pelado o un `{detail: …}` de DRF prueba un contrato que no existe:

```ts
// éxito — C-1
http.get(`${BASE_URL}/api/v1/personal/empleados/`, () =>
  HttpResponse.json({ status: "success", message: "Listado obtenido.", data: [{ cedula: "V-12345678" }] }));

// error de negocio — mismo sobre, status "error", data null
http.post(`${BASE_URL}/api/v1/personal/empleados/`, () =>
  HttpResponse.json({ status: "error", message: "La cédula ya está registrada.", data: null }, { status: 409 }));

// trabajo asíncrono (C-4): 202 + tarea_id, y el sondeo a /api/v1/tareas/{id}/
http.post(`${BASE_URL}/api/v1/reportes/nomina/`, () =>
  HttpResponse.json({ status: "success", message: "Tarea encolada.", data: { tarea_id: "abc-123" } }, { status: 202 }));
```

Toda ruta simulada va bajo `/api/v1/` (**C-6**). Si el test cubre gating por permisos, se afirma
contra la tabla declarativa `CAPACIDADES` (§13.4 de `FASE2_PROPUESTA_TECNICA.md`) — la misma que
alimenta menú y middleware — y con códigos `puede("personal.crear")`, **nunca** comparando
`nombre_rol` (**C-3**, **R16**).

Montaje del entorno:

```ts
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, { value: string }>();
const fakeCookieStore = {
  get: (name: string) => cookieStore.get(name),
  set: (name: string, value: string) => cookieStore.set(name, { value }),
  delete: (name: string) => cookieStore.delete(name),
};

vi.mock("next/headers", () => ({ cookies: async () => fakeCookieStore }));
vi.mock("@/auth", () => ({ signOut: vi.fn() }));

// Importado después de los vi.mock, y BASE_URL leído de la config real (no fijado a mano: puede
// resolver a http://backend:8000 en vez de localhost según el .env cargado).
const { apiClient } = await import("./fetcher-api");
const { API } = await import("@/shared/commons/api");
const BASE_URL = API.url;

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => cookieStore.clear());
```

El caso completo a cubrir (200, 401→refresh→retry, 403, 500) es la tarea **F2.18** del plan; en el
proyecto de origen vivía en `shared/infrastructure/http/fetcher-api.test.ts`, archivo que **en GATH
todavía no existe**. Al escribirlo, es la plantilla a copiar para cualquier otro cliente HTTP que se
aísle de esta forma. El caso 401 debe verificar que el refresco **rota la cookie `dj_access`** y
reintenta una sola vez — sin el `refreshPromise` global de módulo, que es la vulnerabilidad
**CRIT-09** (mezcla de sesiones entre usuarios) corregida en **F0.9** con scope por petición.

---

## 5. Pre-flight checks

- [ ] ¿El test está al lado del archivo que prueba, no en `__tests__/`, y **en el mismo commit** que
      el código (**R11**)?
- [ ] ¿Corre con `pnpm test:unit` (proyecto `unit`, no `storybook`)?
- [ ] Si el archivo importa (directa o transitivamente) `next/headers` o `#/auth` (ojo: `#/`, no
      `@/`), ¿están mockeados con `vi.mock`?
- [ ] ¿Los handlers de MSW devuelven el sobre **C-1** `{status, message, data}` y sus rutas van bajo
      `/api/v1/` (**C-6**)?
- [ ] ¿La sesión se simula con las cookies `dj_access`/`dj_refresh` (**C-2**) y **no** con un token
      en `localStorage`?
- [ ] ¿El schema Zod que pruebas importa sus regex de `shared/validation/` en vez de reimplementarlos
      ([[validacion-input-protegido]])?
- [ ] Si afirmas sobre permisos, ¿lo haces contra `CAPACIDADES` y `puede("modulo.accion")`, sin tocar
      `nombre_rol` (**R16**)?
- [ ] Si el test necesita la URL base de la API, ¿se leyó de `@/shared/commons/api` en vez de
      fijarla a mano? (`.env` puede resolver a un host distinto de `localhost`).
- [ ] ¿`pnpm test:unit` pasa? ¿`pnpm typecheck` sigue en verde?
