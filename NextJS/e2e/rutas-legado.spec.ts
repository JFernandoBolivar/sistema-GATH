import { expect, test } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * G7/G12: rutas del shell legado retiradas. Sus enlaces y marcadores siguen
 * funcionando por las redirecciones del proxy:
 *  - `/inicio` -> `/dashboard` (G7 corregido: el dashboard es el inicio).
 *  - `/censo-vivienda` -> `/autogestion/censo` (G12: el censo vigente).
 */
test.describe("Rutas legadas", () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesionComo(page, EMAIL, PASSWORD);
  });

  test("/inicio redirige a /dashboard y el dashboard muestra los módulos", async ({ page }) => {
    await page.goto("/inicio");
    await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /Sistema de Información Integral/i }),
    ).toBeVisible();
    await expect(page.getByText("Gestión de Trabajadores", { exact: true }).first()).toBeVisible();
  });

  test("«/censo-vivienda» redirige al censo vigente de autogestión", async ({ page }) => {
    await page.goto("/censo-vivienda");
    await page.waitForURL((url) => url.pathname === "/autogestion/censo", {
      timeout: 20_000,
    });
    await expect(page.getByText(/AUTOGESTI/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("los módulos que colgaban del shell legado siguen abriendo", async ({ page }) => {
    for (const [ruta, texto] of [
      ["/personal", /Bienvenid@ a GATH/i],
      ["/movimientos", /Consulta De Movimientos De Trabajadores/i],
    ] as const) {
      await page.goto(ruta);
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page.getByText(texto).first()).toBeVisible({ timeout: 20_000 });
      expect(new URL(page.url()).pathname).toBe(ruta);
    }
  });
});
