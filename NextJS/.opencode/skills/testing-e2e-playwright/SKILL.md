---
name: testing-e2e-playwright
description: Tests E2E con Playwright multi-navegador del frontend Next.js de GATH. Suite en NextJS/e2e/, fixture de login por rol con storageState sobre las cookies HttpOnly dj_access/dj_refresh, Page Objects y los recorridos de aprobación de la Fase 2. Chromium + Firefox + WebKit.
---

# Skill de Tests E2E con Playwright

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Stack verificado en `NextJS/package.json`: Next.js **16.1.3**, React **19.2.3**, `next-auth` **5.0.0-beta.25** (beta en producción), Zod **3.25.x**, TypeScript **5.8.3**.

**Playwright NO está declarado hoy** en `NextJS/package.json` (ni en `dependencies` ni en `devDependencies`), **no existe el directorio `NextJS/e2e/`** y **no existe `playwright.config.ts`**: el frontend tiene **0 tests**. Instalar Playwright y crear la suite es trabajo pendiente de la fase de endurecimiento (**F6.2**: E2E de login, permisos por rol y CRUD de los 11 módulos en los tres navegadores; **F6.2c**: `e2e/specs/accesibilidad.spec.ts`). Todo lo que esta skill describe se **construye**; no asumas que ya está y no afirmes que existe una suite.

Contratos y decisiones que gobiernan esta skill:

- **C-1** — sobre de respuesta único `{status, message, data}`: toda aserción de red (`page.waitForResponse`, intercepciones) se hace contra ese sobre, no contra un payload plano.
- **C-2** — sesión: un solo endpoint de login `POST /api/v1/identidad/auth/login/`; cookies `HttpOnly`, `secure`, `sameSite: "lax"`, `dj_access` (15 min) y `dj_refresh` (8 h); `session.maxAge` de NextAuth sincronizado a **8 h**. Con cookies `HttpOnly` el `storageState` de Playwright es el mecanismo correcto de persistencia de sesión: no hay token en `localStorage` que copiar.
- **C-3** — autorización por códigos `[modulo].[accion]`. Los fixtures se organizan **por rol identificado por `Rol.codigo`** (FASE 2 §5.5), nunca por etiqueta visible ni por usuario nominal (**R16**, **DEC-8**).
- **C-4** — asíncrono: `202 Accepted` + sondeo a `GET /api/v1/tareas/{id}/`. Un E2E de reporte espera el sondeo; **nunca** un `waitForTimeout`.
- **CRIT-03** — ningún secreto va a git: las credenciales de los usuarios de prueba se leen del entorno y ni el `.env` ni el `storageState` generado se versionan (**R15**).
- **R13** — toda ruta con Page Object en `e2e/pages/` lleva su caso de accesibilidad; ver [[testing-a11y-axe]], que corre axe-core sobre estas mismas rutas renderizadas y reutiliza estos fixtures y navegadores.

Esta skill fue heredada de otro proyecto y **reconciliada** para GATH; el registro literal de adaptaciones está en `PLAN_RECONSTRUCCION_ONION.v1.md` **§0.6.2** (adoptada íntegramente, suite en `e2e/`). El cuerpo técnico — configuración multi-navegador, `storageState`, Page Objects genéricos — se conserva; lo que cambia es el mecanismo de sesión, la organización por rol y los recorridos exigidos.

Skills relacionadas: [[testing-unit-vitest]] (lo que se prueba sin navegador: casos de uso puros, schemas Zod, la tabla de capacidades), [[testing-a11y-axe]] (a11y sobre las mismas rutas) y [[arquitecto-scream-feature-onion]] (estructura de `src/modules/` que estos tests espejan).

> Los nombres de módulo que aparecen en los ejemplos de las secciones 4, 8 y 9 (`apoyo`, `comedor`, `transporte/vehiculos`…) son del proyecto de origen y **no existen en GATH**. Los módulos y rutas reales están en `PLAN_RECONSTRUCCION_ONION.v1.md` §0.6.2/§II y en `FASE2_PROPUESTA_TECNICA.md` §13.2. Usa los ejemplos como plantilla, no como inventario.

---

Esta skill complementa la arquitectura Scream-Feature-Onion. Cada vez que se crea o modifica un módulo, se DEBEN generar o actualizar sus tests E2E.

---

## 1. Setup

### Instalación

Playwright **no está instalado hoy** en GATH (verificado en `NextJS/package.json`). Estos comandos son el paso de alta de la fase **F6.2**, no una descripción del estado actual:

```bash
pnpm create playwright --ct --browser chromium,firefox,webkit
# O manual:
pnpm add -D @playwright/test
pnpm exec playwright install chromium firefox webkit
```

### playwright.config.ts

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    // Sin storageState global: en GATH la sesión se elige POR ROL en el fixture (C-3).
    // Un storageState único en `use` obligaría a un usuario nominal y volvería
    // imposible probar que un rol NO puede entrar donde no le toca.
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      dependencies: ["setup"],
    },
  ],
});
```

### Estructura E2E

En GATH la suite vive en **`NextJS/e2e/`** (§0.6.2) y `playwright.config.ts` en la raíz de `NextJS/`, junto a `package.json`, para que `testDir: "./e2e/specs"` resuelva:

```
NextJS/
├── playwright.config.ts               # en la raíz, NO dentro de e2e/
└── e2e/
├── .auth/                             # NO se versiona (CRIT-03, R15)
│   ├── ADMINISTRADOR.json             # un storageState por Rol.codigo
│   ├── CAPTACION.json
│   ├── PRESUPUESTO.json
│   ├── DIRECCION_GENERAL.json
│   ├── BIENESTAR_SOCIAL.json
│   ├── ANALISTA.json
│   ├── RECEPCIONISTA.json
│   └── AUTOGESTION.json
├── global.setup.ts                    # login por rol + storageState
├── fixtures/
│   ├── auth.fixture.ts                # fixture por rol
│   └── invitado.fixture.ts            # sesión de postulante (FASE 2 §13.3)
├── pages/
│   ├── login.page.ts
│   ├── apoyo.page.ts
│   ├── comedor.page.ts
│   ├── transporte/
│   │   ├── vehiculos.page.ts
│   │   ├── choferes.page.ts
│   │   └── viajes.page.ts
│   └── ... (uno por módulo)
├── specs/
│   ├── auth.spec.ts
│   ├── apoyo.spec.ts
│   ├── comedor.spec.ts
│   ├── transporte/
│   │   ├── vehiculos.spec.ts
│   │   ├── choferes.spec.ts
│   │   └── viajes.spec.ts
│   └── ... (uno por módulo)
└── utils/
    └── navigate.ts
```

### Credenciales de los usuarios de prueba

**Nada de esto se versiona (CRIT-03, R15).** Las credenciales se leen del entorno (`.env.test.local` fuera de git, o los *secrets* del runner de CI), una por `Rol.codigo`. El `storageState` generado en `e2e/.auth/` **también** queda fuera de git: es una sesión válida contra el backend real.

```
# .env.test.local — NO se commitea. Añadir e2e/.auth/ y .env.test.local a .gitignore.
E2E_BASE_URL=http://localhost:3000
E2E_ADMINISTRADOR_EMAIL=…      E2E_ADMINISTRADOR_PASS=…
E2E_CAPTACION_EMAIL=…          E2E_CAPTACION_PASS=…
E2E_PRESUPUESTO_EMAIL=…        E2E_PRESUPUESTO_PASS=…
E2E_DIRECCION_GENERAL_EMAIL=…  E2E_DIRECCION_GENERAL_PASS=…
E2E_BIENESTAR_SOCIAL_EMAIL=…   E2E_BIENESTAR_SOCIAL_PASS=…
E2E_ANALISTA_EMAIL=…           E2E_ANALISTA_PASS=…
E2E_RECEPCIONISTA_EMAIL=…      E2E_RECEPCIONISTA_PASS=…
E2E_AUTOGESTION_EMAIL=…        E2E_AUTOGESTION_PASS=…
# Postulante de prueba (sesión de invitado, FASE 2 §13.3): entra por cédula, no por correo.
E2E_POSTULANTE_CEDULA=…        E2E_POSTULANTE_PASS=…
```

Si falta una variable, el setup debe **fallar con mensaje explícito**; jamás caer a un valor por defecto ni a credenciales literales en el código.

---

## 2. Login Fixture + Storage State

### global.setup.ts (setup project)

```typescript
import { test as setup } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/storageState.json");

setup("autenticar y persistir sesión", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="usuario"]', process.env.TEST_USER!);
  await page.fill('input[name="password"]', process.env.TEST_PASS!);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");
  await page.context().storageState({ path: authFile });
});
```

### auth.fixture.ts

```typescript
import { test as base, Page } from "@playwright/test";

export const test = base.extend<{ authPage: Page }>({
  authPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/storageState.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
```

---

## 3. Auto-generación al crear un módulo

**REGLAS (non-negotiable):**

### Regla 1: Nuevo módulo → nuevo E2E

Cuando se crea un módulo nuevo (domain + application + infrastructure + ui), se DEBE generar:

1. `e2e/pages/[modulo].page.ts` — Page Object
2. `e2e/specs/[modulo].spec.ts` — Test spec

### Regla 2: Cambio en módulo → actualizar E2E

Cuando un módulo existente cambia (nuevo campo en schema Zod, nueva server action, cambio en UI), se DEBEN actualizar sus Page Object y spec. Los tests deben reflejar el comportamiento real.

### Regla 3: Todo test corre en Chromium + Firefox + WebKit

No hay excepción. Usar la configuración de projects en `playwright.config.ts`. Si un test necesita `browserName` condicional, usar `test.skip()` con razón documentada.

---

## 4. Template CRUD genérico

### Page Object genérico

Para cualquier módulo con operaciones CRUD estándar:

```typescript
// e2e/pages/[modulo].page.ts
import { Page, expect, Locator } from "@playwright/test";

export class [Nombre]Page {
  // Campos a definir según schema Zod del módulo
  private readonly campoNombre: string;
  private readonly campoTipo: string;

  constructor(
    public readonly page: Page,
    private readonly ruta: string,
    private readonly nombreItem: string,
  ) {
    this.campoNombre = 'input[name="nombre"]';
    this.campoTipo = 'select[name="tipo"]';
  }

  async goto() {
    await this.page.goto(this.ruta);
    await expect(this.page.locator("h1")).toContainText(this.nombreItem, { ignoreCase: true });
  }

  async crear(data: Record<string, string>) {
    await this.page.click('text="Nuevo"');
    for (const [campo, valor] of Object.entries(data)) {
      await this.page.fill(`input[name="${campo}"]`, valor);
    }
    await this.page.click('button[type="submit"]');
    await expect(this.page.locator('[role="status"]')).toContainText("creado", { ignoreCase: true });
  }

  async editar(id: string, data: Record<string, string>) {
    await this.page.click(`a[href*="${id}/editar"]`);
    for (const [campo, valor] of Object.entries(data)) {
      await this.page.fill(`input[name="${campo}"]`, valor);
    }
    await this.page.click('button[type="submit"]');
    await expect(this.page.locator('[role="status"]')).toContainText("actualizado", { ignoreCase: true });
  }

  async eliminar(id: string) {
    await this.page.click(`button[data-id="${id}"]`);
    await this.page.click('button:has-text("Confirmar")');
    await expect(this.page.locator('[role="status"]')).toContainText("eliminado", { ignoreCase: true });
  }

  async verificarEnLista(texto: string) {
    await expect(this.page.locator("table, ul, .grid")).toContainText(texto);
  }

  async verificarAusente(texto: string) {
    await expect(this.page.locator("table, ul, .grid")).not.toContainText(texto);
  }
}
```

### Spec CRUD genérico

```typescript
// e2e/specs/[modulo].spec.ts
import { test, expect } from "../fixtures/auth.fixture";
import { [Nombre]Page } from "../pages/[modulo].page";

test.describe("CRUD [Nombre]", () => {
  let page: [Nombre]Page;

  test.beforeEach(async ({ authPage }) => {
    page = new [Nombre]Page(authPage, "/[ruta]", "[Nombre]");
    await page.goto();
  });

  test("crear, listar, editar y eliminar entidad", async () => {
    const nombre = `Test ${Date.now()}`;
    const nombreEditado = `${nombre} Editado`;

    await test.step("crear", async () => {
      await page.crear({ nombre });
      await page.verificarEnLista(nombre);
    });

    await test.step("editar", async () => {
      await page.editar("ultimo", { nombre: nombreEditado });
      await page.verificarEnLista(nombreEditado);
    });

    await test.step("eliminar", async () => {
      await page.eliminar("ultimo");
      await page.verificarAusente(nombreEditado);
    });
  });
});
```

---

## 5. Test de formularios (Zod-driven)

Cada módulo tiene un schema Zod en `modules/[modulo]/ui/schema/schema-[nombre].ts`. Leer el schema para generar tests de validación:

```typescript
test("validación de formulario - campos requeridos", async ({ authPage }) => {
  const page = new [Nombre]Page(authPage, "/[ruta]", "[Nombre]");
  await page.goto();
  await authPage.click('text="Nuevo"');
  await authPage.click('button[type="submit"]');

  // Los mensajes de error Zod se muestran en el formulario
  await expect(authPage.locator("text=requerido")).toBeVisible();
});

test("validación de formulario - tipos incorrectos", async ({ authPage }) => {
  const page = new [Nombre]Page(authPage, "/[ruta]", "[Nombre]");
  await page.goto();
  await authPage.click('text="Nuevo"');
  await authPage.fill('input[name="nombre"]', "a");  // menos de min length
  await authPage.click('button[type="submit"]');

  await expect(authPage.locator("text=Mínimo")).toBeVisible();
});
```

**Regla:** si el schema cambia (nuevo campo required, cambio de tipo), los tests de validación se DEBEN actualizar.

---

## 6. Test de navegación + layout

```typescript
// e2e/specs/navegacion.spec.ts
import { test, expect } from "../fixtures/auth.fixture";

test.describe("Navegación y layout protegido", () => {
  test("sidebar contiene links a todos los módulos", async ({ authPage }) => {
    await authPage.goto("/");
    const sidebar = authPage.locator("[data-testid=sidebar]");
    const links = ["Dashboard", "Apoyo", "Comedor", "Vehículos", "Choferes"];
    for (const link of links) {
      await expect(sidebar.locator(`text="${link}"`).first()).toBeVisible();
    }
  });

  test("cada link de sidebar navega a la ruta correcta", async ({ authPage }) => {
    await authPage.goto("/");
    const links = [
      { label: "Dashboard", ruta: "/" },
      { label: "Apoyo", ruta: "/apoyo" },
      { label: "Comedor", ruta: "/comedor" },
    ];
    for (const { label, ruta } of links) {
      await authPage.click(`text="${label}"`);
      await expect(authPage).toHaveURL(ruta);
    }
  });

  test("breadcrumb refleja la ruta actual", async ({ authPage }) => {
    await authPage.goto("/apoyo");
    await expect(authPage.locator("[data-testid=breadcrumb]")).toContainText("Apoyo");
  });
});

test.describe("Rutas protegidas", () => {
  test("sin autenticación redirige a /login", async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/apoyo");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });
});
```

---

## 7. Test autenticación

```typescript
// e2e/specs/auth.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Autenticación", () => {
  test("login exitoso redirige a dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="usuario"]', process.env.TEST_USER!);
    await page.fill('input[name="password"]', process.env.TEST_PASS!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("login con credenciales inválidas muestra error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="usuario"]', "00000000");
    await page.fill('input[name="password"]', "wrongpass");
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="status"], [role="alert"]')).toContainText("error", {
      ignoreCase: true,
    });
  });

  test("logout cierra sesión y redirige a login", async ({ authPage }) => {
    await authPage.goto("/");
    await authPage.click('[data-testid="logout-button"]');
    await expect(authPage).toHaveURL(/\/login/);
  });
});
```

---

## 8. Test por submódulo

Los submódulos siguen el mismo patrón que los módulos, pero anidados bajo `transporte/`:

```typescript
// e2e/pages/transporte/vehiculos.page.ts
export class VehiculosPage {
  // mismo template que [modulo].page.ts
}

// e2e/pages/transporte/choferes.page.ts
export class ChoferesPage {
  // mismo template
}
```

```typescript
// e2e/specs/transporte/vehiculos.spec.ts
test.describe("CRUD Vehículos (submódulo)", () => {
  // mismo template CRUD
});
```

**Regla:** la estructura de carpetas en `e2e/pages/` y `e2e/specs/` DEBE reflejar la estructura de `modules/`. Si `modules/transporte/vehiculos/` existe, debe existir `e2e/pages/transporte/vehiculos.page.ts` y `e2e/specs/transporte/vehiculos.spec.ts`.

---

## 9. Mapeo módulo → ruta URL

Los thin wrappers en `app/(app)/` definen las rutas. Este mapeo se usa en los Page Objects:

```
modules/apoyo/            → app/(app)/apoyo/page.tsx              → /apoyo
modules/apoyo/            → app/(app)/apoyo/[id]/editar/page.tsx  → /apoyo/:id/editar
modules/comedor/          → app/(app)/comedor/page.tsx            → /comedor
modules/comedor/          → app/(app)/comedor/asistencia/page.tsx → /comedor/asistencia
modules/servicios/        → app/(app)/servicios/page.tsx          → /servicios
modules/servicios/        → app/(app)/servicios/crear/page.tsx    → /servicios/crear
modules/transporte/vehiculos/ → app/(app)/vehiculos/page.tsx      → /vehiculos
modules/transporte/choferes/  → app/(app)/choferes/page.tsx       → /choferes
```

**Regla:** todo módulo/submódulo con página en `app/` DEBE tener al menos un test E2E que verifique que la ruta carga correctamente.

---

## 10. Scripts en package.json

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:chromium": "playwright test --project=chromium",
    "test:e2e:firefox": "playwright test --project=firefox",
    "test:e2e:webkit": "playwright test --project=webkit",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

---

## 11. Pre-flight checks

Antes de dar por terminado cualquier módulo o modificación:

- [ ] ¿El módulo tiene su Page Object en `e2e/pages/[modulo].page.ts`?
- [ ] ¿El módulo tiene su test spec en `e2e/specs/[modulo].spec.ts`?
- [ ] ¿Los tests reflejan el schema Zod actual del módulo?
- [ ] ¿Los tests reflejan las server actions actuales del módulo?
- [ ] ¿Los tests pasan en chromium?
- [ ] ¿Los tests pasan en firefox?
- [ ] ¿Los tests pasan en webkit?
- [ ] ¿El login fixture (`global.setup.ts`) funciona correctamente?
- [ ] ¿Los tests de navegación cubren el link del nuevo módulo?
- [ ] ¿La estructura de `e2e/pages/` y `e2e/specs/` refleja la estructura de `modules/`?

Si alguna respuesta es NO, el módulo no está completo.
