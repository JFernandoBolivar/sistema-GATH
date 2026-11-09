import { devices, expect, test, type Page } from "@playwright/test";

import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Autogestión en simulación de teléfonos (Chromium): sin desbordes
 * horizontales, pestañas desplazables y ficha usable en cada modelo.
 */
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL ?? "";
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD ?? "";

test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "Faltan E2E_BIEN_EMAIL/E2E_BIEN_PASSWORD.");

const MODELOS = [
  { nombre: "pixel-7", perfil: devices["Pixel 7"] },
  { nombre: "iphone-14", perfil: devices["iPhone 14"] },
  { nombre: "galaxy-s24", perfil: devices["Galaxy S24"] },
] as const;

async function sinDesbordes(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth <= doc.clientWidth + 1;
  });
}

for (const modelo of MODELOS) {
  test.describe(`Autogestión en ${modelo.nombre}`, () => {
    const { defaultBrowserType: _ignorado, ...perfil } = modelo.perfil;
    test.use(perfil);

    test("la ficha no desborda y las pestañas se desplazan", async ({ page }) => {
      await iniciarSesionComo(page, BIEN_EMAIL, BIEN_PASSWORD);

      await page.goto("/autogestion");
      await expect(page.locator("#contenido-principal")).toBeVisible({ timeout: 30_000 });
      expect(await sinDesbordes(page)).toBe(true);

      await page.goto("/autogestion/ficha");
      await expect(page.getByRole("tab", { name: /datos personales/i })).toBeVisible({
        timeout: 30_000,
      });
      expect(await sinDesbordes(page)).toBe(true);

      await page.getByRole("tab", { name: /ubicación laboral/i }).click();
      await expect(page.getByText("Dependencia", { exact: true })).toBeVisible();

      await page.screenshot({
        path: `e2e-results/autogestion-${modelo.nombre}.png`,
        fullPage: true,
      });
    });
  });
}
