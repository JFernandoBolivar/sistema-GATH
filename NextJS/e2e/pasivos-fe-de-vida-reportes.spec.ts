import { expect, test } from "@playwright/test";

import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Feedback: Fe de vida y Reportes de pasivos deben quedarse en el módulo de
 * pasivos y permitir descargar el reporte como en activos.
 */
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL ?? "";
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD ?? "";

test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "Faltan E2E_BIEN_EMAIL/E2E_BIEN_PASSWORD.");

test("Fe de vida desde pasivos no salta al módulo de activos", async ({ page }) => {
  await iniciarSesionComo(page, BIEN_EMAIL, BIEN_PASSWORD);
  await page.goto("/pasivos/consultar", { waitUntil: "domcontentloaded" });

  const sidebar = page.locator("[data-sidebar='sidebar']");
  const grupoFeDeVida = sidebar.getByRole("button", { name: /^fe de vida$/i });
  const enlaceBandeja = sidebar.getByRole("link", { name: /bandeja de revisión/i });
  // El submenú puede estar abierto o cerrado y el primer clic puede perderse si
  // React aún no hidrató: se reintenta hasta que el enlace esté visible.
  await expect(grupoFeDeVida).toBeVisible();
  await expect(async () => {
    if (!(await enlaceBandeja.isVisible().catch(() => false))) {
      await grupoFeDeVida.click();
    }
    expect(await enlaceBandeja.isVisible().catch(() => false)).toBe(true);
  }).toPass({ timeout: 30_000 });
  await enlaceBandeja.click();

  await expect(page).toHaveURL(/\/pasivos\/fe-de-vida$/);
  await expect(page.getByRole("button", { name: /gestion personal pasivo/i })).toBeVisible();
});

test("Familiares de pasivos se consultan dentro del módulo de pasivos", async ({ page }) => {
  await iniciarSesionComo(page, BIEN_EMAIL, BIEN_PASSWORD);
  await page.goto("/pasivos/consultar", { waitUntil: "domcontentloaded" });

  const sidebar = page.locator("[data-sidebar='sidebar']");
  // En /pasivos/consultar el submenú ya está abierto.
  await sidebar.getByRole("link", { name: /consultar familiar/i }).click();

  await expect(page).toHaveURL(/\/pasivos\/familiares\/consultar/);
  await expect(page.getByRole("button", { name: /gestion personal pasivo/i })).toBeVisible();
});

test("Reportes de pasivos descarga PDF como en activos", async ({ page }) => {
  // El reporte de pasivos se genera en Celery y con la base local tarda ~90 s;
  // bajo carga (varios workers) puede pasar de 4 min.
  test.setTimeout(420_000);
  await iniciarSesionComo(page, BIEN_EMAIL, BIEN_PASSWORD);
  await page.goto("/pasivos/reportes", { waitUntil: "domcontentloaded" });

  // La pantalla de reportes de pasivos ya no usa pestañas ni botón Excel: es el
  // mismo reporte de activos con su título. El PDF se consulta y luego se
  // descarga desde el enlace que aparece con el resultado.
  await expect(page.getByRole("heading", { name: /reporte de pasivos/i })).toBeVisible();
  const consultar = page.getByRole("button", { name: /consultar reporte general/i });
  await expect(consultar).toBeVisible();
  await expect(consultar).toBeEnabled();

  await consultar.click();
  const descargar = page.getByRole("link", { name: /descargar reporte/i });
  await expect(descargar).toBeVisible({ timeout: 300_000 });

  const [descarga] = await Promise.all([
    page.waitForEvent("download"),
    descargar.click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/\.pdf$/);
});
