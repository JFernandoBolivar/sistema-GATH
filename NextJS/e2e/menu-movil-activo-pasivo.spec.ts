import { devices, expect, test } from "@playwright/test";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Regresión del reporte «en el teléfono el menú se queda pegado al pasar de
 * Gestión Personal Activo a Pasivo y no vuelve a abrir».
 *
 * Causa: el `Sheet` móvil y el `DropdownMenu` del selector anidan dos capas
 * modales de Radix. Al cambiar de módulo (layout distinto) se desmontaban con
 * el menú abierto y el body quedaba con `pointer-events: none`, así que ningún
 * toque funcionaba hasta recargar.
 */
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

const MENU_MOVIL_ABIERTO = '[data-slot="sidebar"][data-mobile="true"][data-state="open"]';
const DISPARADOR_MENU = '[data-sidebar="trigger"]';

test.use({ ...devices["Pixel 7"] });

test.describe("Menú móvil al cambiar entre Personal Activo y Pasivo", () => {
  test.skip(!EMAIL || !PASSWORD, "Faltan E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD");

  test("no deja la página sin toques y el menú vuelve a abrir", async ({ page }) => {
    await iniciarSesionComo(page, EMAIL, PASSWORD);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle").catch(() => {});

    const disparador = page.locator(DISPARADOR_MENU).first();
    await disparador.click();
    await expect(page.locator(MENU_MOVIL_ABIERTO)).toBeVisible();

    const selector = page.getByRole("button", { name: /gestion personal activo/i }).first();
    test.skip(
      (await selector.count()) === 0,
      "La cuenta E2E no tiene personal.ver y pasivos.ver a la vez",
    );
    await selector.click();
    await page
      .getByRole("menuitem", { name: /personal pasivo/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/pasivos/);

    // Antes quedaba `pointer-events: none` en el body y nada respondía.
    await expect
      .poll(() => page.evaluate(() => document.body.style.pointerEvents), { timeout: 5_000 })
      .not.toBe("none");

    await disparador.click();
    await expect(page.locator(MENU_MOVIL_ABIERTO)).toBeVisible();
  });

  test("al navegar dentro del mismo módulo el menú se cierra solo", async ({ page }) => {
    await iniciarSesionComo(page, EMAIL, PASSWORD);
    await page.goto("/personal");
    await page.locator(DISPARADOR_MENU).first().click();
    await expect(page.locator(MENU_MOVIL_ABIERTO)).toBeVisible();

    const enlace = page.locator(`${MENU_MOVIL_ABIERTO} a[href^="/personal/"]`).first();
    test.skip((await enlace.count()) === 0, "El menú no tiene enlaces internos de Personal");

    await enlace.click();
    await expect(page.locator(MENU_MOVIL_ABIERTO)).toHaveCount(0);
  });
});
