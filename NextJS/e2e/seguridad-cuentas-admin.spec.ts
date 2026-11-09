import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * A1/A2 en vivo: un ANALISTA no puede restablecer el acceso ni cambiar el
 * correo de una cuenta ADMINISTRADORA, pero sí puede atender una cuenta básica.
 *
 * Datos por entorno (nunca en el repo):
 *   E2E_A1_ANALISTA_EMAIL/PASSWORD, E2E_A1_ADMIN_ID, E2E_A1_ADMIN_CEDULA,
 *   E2E_A1_BASICA_ID, E2E_A1_BASICA_CEDULA.
 */
const ANALISTA_EMAIL = process.env.E2E_A1_ANALISTA_EMAIL;
const ANALISTA_PASSWORD = process.env.E2E_A1_ANALISTA_PASSWORD;
const ADMIN_ID = process.env.E2E_A1_ADMIN_ID;
const ADMIN_CEDULA = process.env.E2E_A1_ADMIN_CEDULA;
const BASICA_ID = process.env.E2E_A1_BASICA_ID;
const BASICA_CEDULA = process.env.E2E_A1_BASICA_CEDULA;
const MOTIVO = "Prueba E2E de la regla de cuentas administrativas";

async function sinViolacionesGraves(page: Page) {
  const resultado = await new AxeBuilder({ page }).analyze();
  const graves = resultado.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(graves, JSON.stringify(graves.map((v) => v.id))).toEqual([]);
}

test.describe("A1/A2: cuentas administrativas", () => {
  test("un analista no restablece ni cambia el correo de un administrador", async ({ page }) => {
    test.setTimeout(240_000);
    test.skip(
      !ANALISTA_EMAIL || !ANALISTA_PASSWORD || !ADMIN_ID || !ADMIN_CEDULA,
      "faltan los datos E2E_A1_* del analista y del administrador",
    );
    await iniciarSesionComo(page, ANALISTA_EMAIL as string, ANALISTA_PASSWORD as string);
    await page.goto(`/usuarios/${ADMIN_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByText(new RegExp(`Cédula ${ADMIN_CEDULA}`))).toBeVisible({
      timeout: 20_000,
    });
    await sinViolacionesGraves(page);

    await page.getByLabel("Motivo del restablecimiento").fill(MOTIVO);
    await page.getByRole("button", { name: /Restablecer acceso/i }).click();
    await expect(page.getByText(/(No tienes permiso|Solo un administrador)/i).last()).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel("Motivo del cambio de correo").fill(MOTIVO);
    await page.getByRole("button", { name: /Guardar correo/i }).click();
    await expect(page.getByText(/(No tienes permiso|Solo un administrador)/i).last()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("un administrador sí atiende una cuenta básica", async ({ page }) => {
    test.setTimeout(240_000);
    test.skip(
      !BASICA_ID || !BASICA_CEDULA,
      "faltan los datos E2E_A1_* de la cuenta básica",
    );
    await iniciarSesionComo(page, EMAIL, PASSWORD);
    await page.goto(`/usuarios/${BASICA_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByText(new RegExp(`Cédula ${BASICA_CEDULA}`))).toBeVisible({
      timeout: 20_000,
    });
    await sinViolacionesGraves(page);

    await page.getByLabel("Motivo del restablecimiento").fill(MOTIVO);
    await page.getByRole("button", { name: /Restablecer acceso/i }).click();
    await expect(page.getByText(/Acceso restablecido/i).last()).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel("Motivo del cambio de correo").fill(MOTIVO);
    await page.getByRole("button", { name: /Guardar correo/i }).click();
    await expect(page.getByText(/Correo de acceso actualizado/i).last()).toBeVisible({
      timeout: 20_000,
    });
  });
});
