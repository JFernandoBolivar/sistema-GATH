import { expect, test } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * G7 corregido: /dashboard es la pantalla principal y muestra SOLO los módulos
 * de primer nivel, según los permisos de la sesión.
 */
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL;
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD;
const CAPTURAS = process.env.DASHBOARD_CAPTURA_DIR;

const MODULOS_PRIMER_NIVEL = [
  "Administración del sistema",
  "Gestión de Trabajadores",
  "Carnetización",
  "Autogestión",
];

test("el dashboard muestra solo los cuatro módulos de primer nivel", async ({ page }) => {
  test.setTimeout(240_000);
  await iniciarSesionComo(page, EMAIL, PASSWORD);
  await page.goto("/dashboard");
  await page.locator("#dashboard-modulos").waitFor({ state: "visible", timeout: 30_000 });

  await expect(page.locator("h1", { hasText: "Sistema de Información Integral" })).toBeVisible();
  for (const modulo of MODULOS_PRIMER_NIVEL) {
    await expect(
      page.locator("#dashboard-modulos").getByText(modulo, { exact: true }).first(),
    ).toBeVisible();
  }
  // Los módulos que viven dentro de Gestión de Trabajadores no son tarjetas.
  for (const submodulo of ["Cargos", "Cargas familiares", "Movimientos", "Reportes"]) {
    await expect(
      page.locator("#dashboard-modulos").getByText(submodulo, { exact: true }),
    ).toHaveCount(0);
  }
});

test("un perfil de Bienestar no ve la tarjeta de Administración del sistema", async ({ page }) => {
  test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "faltan las credenciales E2E de Bienestar");
  await iniciarSesionComo(page, BIEN_EMAIL as string, BIEN_PASSWORD as string);
  await page.goto("/dashboard");
  await page.locator("#dashboard-modulos").waitFor({ state: "visible", timeout: 30_000 });

  await expect(
    page.locator("#dashboard-modulos").getByText("Gestión de Trabajadores", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.locator("#dashboard-modulos").getByText("Administración del sistema", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator("#dashboard-modulos").getByText("Carnetización", { exact: true }),
  ).toHaveCount(0);
});

test("capturas del dashboard (escritorio y 390 px)", async ({ page }) => {
  test.setTimeout(240_000);
  test.skip(!CAPTURAS, "defina DASHBOARD_CAPTURA_DIR para guardar capturas");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await iniciarSesionComo(page, EMAIL, PASSWORD);
  await page.goto("/dashboard");
  await page.locator("#dashboard-modulos").waitFor({ state: "visible", timeout: 30_000 });
  await page.screenshot({ path: `${CAPTURAS}/gath-dashboard-escritorio.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${CAPTURAS}/gath-dashboard-390.png`, fullPage: true });
});
