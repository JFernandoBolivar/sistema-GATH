import { expect, test, type Page } from "@playwright/test";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Fe de vida (C10-C18). Credenciales solo por entorno (R15):
 *  - PASIVO (condición PASIVO, permiso fe_de_vida.solicitar): E2E_PASIVO_EMAIL / E2E_PASIVO_PASSWORD.
 *  - BIENESTAR (analista o administradora con fe_de_vida.revisar): E2E_BIEN_EMAIL / E2E_BIEN_PASSWORD.
 * Requiere un proceso de fe de vida ABIERTO que alcance al pasivo de prueba. Un perfil sin
 * credenciales se omite. La cámara se simula con los flags de Chromium para medios falsos.
 */
const PASIVO_EMAIL = process.env.E2E_PASIVO_EMAIL;
const PASIVO_PASSWORD = process.env.E2E_PASIVO_PASSWORD;
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL;
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD;

/** PNG válido de 1x1 píxel (la foto de prueba para la subida de archivo). */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function recorrerHastaLaFoto(page: Page): Promise<void> {
  await page.goto("/autogestion/fe-de-vida");
  const comenzar = page.getByRole("button", { name: /comenzar mi fe de vida/i });
  if (await comenzar.isVisible().catch(() => false)) await comenzar.click();
  await expect(page.getByRole("heading", { name: /sus datos registrados/i })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/teléfono celular/i).fill("0412-1234567");
  await page.getByLabel(/no tengo hijos/i).check();
  await page.getByRole("button", { name: /^continuar/i }).click();
  await expect(page.getByRole("heading", { name: /contacto de emergencia y dirección/i })).toBeVisible();
  await page.getByRole("button", { name: /^continuar/i }).click();
  await expect(page.getByRole("heading", { name: /foto con su cédula/i })).toBeVisible();
}

test.describe("Fe de vida del pasivo con cámara falsa", () => {
  test.skip(!PASIVO_EMAIL || !PASIVO_PASSWORD, "Faltan E2E_PASIVO_EMAIL / E2E_PASIVO_PASSWORD");
  test.use({
    permissions: ["camera"],
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  });

  test("completa el flujo: datos, foto por cámara, revisión y envío", async ({ page }) => {
    await iniciarSesionComo(page, PASIVO_EMAIL!, PASIVO_PASSWORD!);
    await recorrerHastaLaFoto(page);
    await page.getByRole("button", { name: /tomar foto/i }).click();
    await expect(page.getByLabel(/vista en vivo de la cámara/i)).toBeVisible();
    await page.getByRole("button", { name: /capturar foto/i }).click();
    await expect(page.getByRole("button", { name: /repetir foto/i })).toBeVisible();
    await page.getByRole("button", { name: /^continuar/i }).click();
    await expect(page.getByRole("heading", { name: /revise y envíe/i })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel(/declaro que los datos/i).check();
    await page.getByRole("button", { name: /enviar fe de vida/i }).click();
    await expect(page.getByText(/en revisión|pendiente|enviada/i).first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("Fe de vida del pasivo solo con subida de archivo", () => {
  test.skip(!PASIVO_EMAIL || !PASIVO_PASSWORD, "Faltan E2E_PASIVO_EMAIL / E2E_PASIVO_PASSWORD");
  // Sin cámara ni permiso: la vía de subir un archivo siempre debe quedar disponible.

  test("sube una foto desde el equipo y llega a la revisión", async ({ page }) => {
    await iniciarSesionComo(page, PASIVO_EMAIL!, PASIVO_PASSWORD!);
    await recorrerHastaLaFoto(page);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "cedula.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await page.getByRole("button", { name: /^continuar/i }).click();
    await expect(page.getByRole("heading", { name: /revise y envíe/i })).toBeVisible({ timeout: 30_000 });
  });

  test("rechaza un archivo que no es una foto y no permite continuar", async ({ page }) => {
    await iniciarSesionComo(page, PASIVO_EMAIL!, PASIVO_PASSWORD!);
    await recorrerHastaLaFoto(page);
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 no es una imagen"),
    });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: /^continuar/i })).toBeDisabled();
  });
});

test.describe("Revisión de Bienestar", () => {
  test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "Faltan E2E_BIEN_EMAIL / E2E_BIEN_PASSWORD");

  test("la bandeja filtra y el detalle muestra la foto y los botones por permiso", async ({ page }) => {
    await iniciarSesionComo(page, BIEN_EMAIL!, BIEN_PASSWORD!);
    await page.goto("/personal/fe-de-vida");
    await expect(page.getByRole("heading", { name: /fe de vida del personal pasivo/i })).toBeVisible();
    await page.getByLabel(/^estado$/i).selectOption("PENDIENTE_REVISION");
    await page.getByRole("button", { name: /buscar/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /mostrando/i })).toBeVisible({ timeout: 30_000 });

    const abrir = page.getByRole("link", { name: /abrir la fe de vida de/i }).first();
    test.skip(!(await abrir.isVisible().catch(() => false)), "No hay solicitudes pendientes de revisión");
    await abrir.click();
    await expect(page.getByRole("heading", { name: /foto con la cédula/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /ampliar/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /datos propuestos por el pasivo/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /devolver para corrección/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /rechazar/i })).toBeVisible();

    // Devolver exige motivo.
    await page.getByRole("button", { name: /devolver para corrección/i }).click();
    await page.getByRole("button", { name: /^devolver$/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel(/requiere una foto nueva/i)).toBeVisible();
  });

  test("procesos y cobertura cargan con sus filtros", async ({ page }) => {
    await iniciarSesionComo(page, BIEN_EMAIL!, BIEN_PASSWORD!);
    await page.goto("/personal/fe-de-vida/cobertura");
    await expect(page.getByRole("heading", { name: /cobertura de pasivos/i })).toBeVisible();
    await page.getByLabel(/sin correo/i).check();
    await page.getByRole("button", { name: /buscar/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /mostrando/i }).or(page.getByText(/sin resultados/i))).toBeVisible({ timeout: 30_000 });
  });
});
