import { test, expect, type Page } from "@playwright/test";

/**
 * Smoke test E2E de verificación final: backend Django + frontend NextJS
 * contra una base de datos real (originalmente corrido contra NUEVABD-GATH,
 * task_b957536104d2). Recorre las 12 rutas de `app/(app)/*` con un usuario
 * ADMINISTRADOR y ejerce una interacción representativa en personal/
 * reportes/carnetización (ver detalle de expediente, cambio de pestañas).
 *
 * Credenciales por entorno (CRIT-03/R15, ver [[testing-e2e-playwright]]):
 * nunca hardcodeadas ni versionadas. Definir en `.env.test.local` (fuera de
 * git) un usuario con rol ADMINISTRADOR:
 *   E2E_ADMIN_EMAIL=...
 *   E2E_ADMIN_PASSWORD=...
 * Si faltan, el test falla explícitamente en vez de usar un valor por
 * defecto o credenciales literales.
 *
 * NO se levanta el servidor aquí (`webServer` no está configurado en
 * playwright.config.ts): backend y frontend deben estar corriendo contra la
 * BD real antes de ejecutar este archivo (ver E2E_BASE_URL en
 * playwright.config.ts).
 */
const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  throw new Error(
    "Faltan E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD (definir en .env.test.local, nunca en el código).",
  );
}

const RUTAS = [
  "usuarios",
  "personal",
  "cargos",
  "familiares",
  "organizacion",
  "movimientos",
  "pasivos",
  "carnetizacion",
  "autogestion",
  "reportes",
  "catalogos",
  "inicio",
] as const;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(EMAIL);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: /ingresar al sistema/i }).click();
  await expect(page).toHaveURL(/\/dashboard|\/inicio|\/$/, { timeout: 15_000 });
}

/** Sin overlay de error de Next.js, sin 500, con contenido real (no un shell vacío). */
async function assertPaginaCargaSinError(page: Page, ruta: string) {
  await expect(page.locator("text=/application error/i")).toHaveCount(0);
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.trim().length, `la ruta /${ruta} debería renderizar contenido real, no un shell vacío`).toBeGreaterThan(20);
  expect(bodyText).not.toMatch(/unhandled runtime error/i);
}

test.describe("Smoke E2E — sistema migrado contra NUEVABD-GATH", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const ruta of RUTAS) {
    test(`la ruta /${ruta} carga sin error`, async ({ page }) => {
      const response = await page.goto(`/${ruta}`, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `GET /${ruta}`).toBeLessThan(500);
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await assertPaginaCargaSinError(page, ruta);
    });
  }

  test("personal: la tabla lista empleados reales y el detalle del expediente abre", async ({ page }) => {
    await page.goto("/personal");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const filas = page.locator("table tbody tr");
    await expect(filas.first()).toBeVisible({ timeout: 15_000 });
    await expect(filas).not.toHaveCount(0);

    // El botón "Ver detalle" (ícono Eye) es el primer botón de acciones de la fila
    // cuando el rol tiene personal.ver_detalle (ADMINISTRADOR lo tiene).
    const primeraFila = filas.first();
    const botonesAccion = primeraFila.locator("button");
    await expect(botonesAccion.first()).toBeVisible();
    await botonesAccion.first().click();

    await expect(page.getByText("Expediente del trabajador")).toBeVisible({ timeout: 10_000 });
  });

  test("reportes: cambiar de pestaña a Tendencias muestra la gráfica", async ({ page }) => {
    await page.goto("/reportes");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await page.getByRole("tab", { name: "Tendencias" }).click();
    await expect(page.getByText(/ingresos y egresos de personal/i)).toBeVisible({ timeout: 10_000 });
  });

  test("carnetizacion: cambiar de pestaña a Estadísticas muestra contenido", async ({ page }) => {
    await page.goto("/carnetizacion");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await page.getByRole("tab", { name: "Estadísticas" }).click();
    await page.waitForTimeout(500);
    await assertPaginaCargaSinError(page, "carnetizacion (tab estadisticas)");
  });
});
