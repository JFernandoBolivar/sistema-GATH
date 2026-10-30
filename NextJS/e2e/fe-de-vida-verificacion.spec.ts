import { expect, test } from "@playwright/test";

/**
 * Verificación pública de la constancia de fe de vida (el QR del documento impreso).
 * Se abre SIN sesión. Un código con formato válido pero inexistente no revela si existe (404 genérico).
 * Para la constancia real, defina E2E_CONSTANCIA_CODIGO (hash de 64 caracteres de una constancia VALIDADA).
 */
const CODIGO_REAL = process.env.E2E_CONSTANCIA_CODIGO;
const CODIGO_INEXISTENTE = "f".repeat(64);

test.describe("Verificación pública de constancia (sin sesión)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("un código inexistente muestra «no encontrada o inválida», sin redirigir al login", async ({ page }) => {
    await page.goto(`/fe-de-vida/verificar/${CODIGO_INEXISTENTE}`);
    await expect(page).toHaveURL(new RegExp(`/fe-de-vida/verificar/${CODIGO_INEXISTENTE}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Constancia de Comparecencia o Fe de Vida" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Constancia no encontrada o inválida");
    await expect(page.getByText("N.° de constancia")).toHaveCount(0);
  });

  test("un código mal formado también es inválido", async ({ page }) => {
    await page.goto("/fe-de-vida/verificar/no-es-un-codigo");
    await expect(page.getByRole("status")).toContainText("Constancia no encontrada o inválida");
  });

  test("una constancia válida muestra la ficha con la cédula oculta y sin descarga", async ({ page }) => {
    test.skip(!CODIGO_REAL, "Defina E2E_CONSTANCIA_CODIGO con el código de una constancia validada.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/fe-de-vida/verificar/${CODIGO_REAL}`);
    await expect(page.getByRole("status")).toContainText("Constancia válida");
    await expect(page.getByText("N.° de constancia")).toBeVisible();
    await expect(page.getByText(/\*/).first()).toBeVisible();
    await expect(page.getByText("Compare estos datos con el documento impreso.")).toBeVisible();
    await expect(page.getByText(/Funcionario\(s\) que certifica/)).toHaveCount(0);
    await expect(page.getByText(/descargar/i)).toHaveCount(0);
    const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(desborda).toBe(false);
  });
});
