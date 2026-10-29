import { test, expect, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";

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
  await iniciarSesionE2E(page);
}

/** Sin overlay de error de Next.js, sin 500, con contenido real (no un shell vacío). */
async function assertPaginaCargaSinError(page: Page, ruta: string) {
  await expect(page.locator("text=/application error/i")).toHaveCount(0);
  const bodyText = await page.locator("body").innerText();
  expect(
    bodyText.trim().length,
    `la ruta /${ruta} debería renderizar contenido real, no un shell vacío`,
  ).toBeGreaterThan(20);
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

  test("personal: la tabla lista empleados reales y el detalle del expediente abre", async ({
    page,
  }) => {
    await page.goto("/personal/consultar");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    const filas = page.locator("table tbody tr");
    await expect(filas.first()).toBeVisible({ timeout: 45_000 });
    await expect(filas).not.toHaveCount(0);

    // Las acciones de fila están en un menú ("Abrir Menu" -> "Ver Detalles").
    await filas.first().getByRole("button", { name: /abrir menu/i }).click();
    await page.getByText("Ver Detalles").click();

    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Información Detallada Del Trabajador" }),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("reportes: /reportes muestra la gráfica de distribución", async ({ page }) => {
    // La versión con pestañas (reportes-page.tsx) ya no está enrutada: /reportes
    // renderiza ReportDistribution.
    await page.goto("/reportes");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.getByText("Distribución por Departamento")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("carnetizacion: /carnetizacion/estadisticas muestra contenido", async ({ page }) => {
    await page.goto("/carnetizacion/estadisticas");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await assertPaginaCargaSinError(page, "carnetizacion/estadisticas");
  });
});
