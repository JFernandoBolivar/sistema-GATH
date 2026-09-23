import { test, expect, type Page } from "@playwright/test";

/**
 * Cascadas de catálogos en los diálogos de actualización de /personal/consultar
 * (Estado -> Municipio -> Parroquia / Código Postal y Nivel -> Carrera -> Mención).
 * Solo abre y navega los selects: NO guarda, para no modificar la BD real.
 */
const EMAIL = process.env.E2E_ADMIN_EMAIL || "usuario.prueba.e2e@conatel.gob.ve";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "E2eSmokeTest!2026";
const CEDULA = "30540767";

async function abrirDetalle(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/correo electrónico/i).fill(EMAIL);
  await page.getByLabel(/contraseña/i).fill(PASSWORD);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await page.goto("/personal/consultar");
  await page.getByPlaceholder("buscar cedula...").fill(CEDULA);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("button", { name: /abrir menu/i }).first().click();
  await page.getByText("Ver Detalles").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Información Detallada Del Trabajador" })).toBeVisible();
  return sheet;
}

test.describe("Personal - cascadas en diálogos de actualización", () => {
  test("Vivienda: el estado filtra municipio y código postal; el municipio filtra parroquia", async ({ page }) => {
    const sheet = await abrirDetalle(page);
    await sheet.locator("div").filter({ hasText: /^Datos De Vivienda/ }).first().getByRole("button", { name: "Actualizar" }).click();
    const dialogo = page.getByRole("dialog").filter({ hasText: "Datos Socio-economicos" });
    await expect(dialogo).toBeVisible();

    await dialogo.locator("#estadoId").click();
    // Un estado distinto al guardado (Radix no dispara onValueChange si se repite el valor).
    await page.getByRole("option", { selected: false }).first().click();
    // Al cambiar de estado se limpian los dependientes y se cargan los filtrados.
    await expect(dialogo.locator("#municipioId")).toContainText("Seleccione un Municpio");
    await dialogo.locator("#municipioId").click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.getByRole("option").first().click();
    await dialogo.locator("#parroquiaId").click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await dialogo.locator("#codigoPostalId").click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Formación Académica: el nivel filtra carreras", async ({ page }) => {
    const sheet = await abrirDetalle(page);
    await sheet.locator("div").filter({ hasText: /^Formaciones Academicas/ }).first().getByRole("button", { name: "Actualizar" }).click();
    const dialogo = page.getByRole("dialog").filter({ hasText: "Opcional si no posee formación académica" });
    await expect(dialogo).toBeVisible();

    const combos = dialogo.getByRole("combobox");
    await combos.nth(0).click();
    await page.getByRole("option", { selected: false }).first().click();
    await expect(combos.nth(1)).toContainText("Seleccione");
    await combos.nth(1).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
