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
  await page.goto("/pasivos/consultar");

  const sidebar = page.locator("[data-sidebar='sidebar']");
  await sidebar.getByRole("button", { name: /fe de vida/i }).click();
  await sidebar.getByRole("link", { name: /bandeja de revisión/i }).click();

  await expect(page).toHaveURL(/\/pasivos\/fe-de-vida$/);
  await expect(page.getByRole("button", { name: /gestion personal pasivo/i })).toBeVisible();
});

test("Familiares de pasivos se consultan dentro del módulo de pasivos", async ({ page }) => {
  await iniciarSesionComo(page, BIEN_EMAIL, BIEN_PASSWORD);
  await page.goto("/pasivos/consultar");

  const sidebar = page.locator("[data-sidebar='sidebar']");
  // En /pasivos/consultar el submenú ya está abierto.
  await sidebar.getByRole("link", { name: /consultar familiar/i }).click();

  await expect(page).toHaveURL(/\/pasivos\/familiares\/consultar/);
  await expect(page.getByRole("button", { name: /gestion personal pasivo/i })).toBeVisible();
});

test("Reportes de pasivos descarga PDF como en activos", async ({ page }) => {
  await iniciarSesionComo(page, BIEN_EMAIL, BIEN_PASSWORD);
  await page.goto("/pasivos/reportes");

  await expect(page.getByRole("tab", { name: /pasivos/i })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("button", { name: /^excel$/i })).toBeVisible();

  const [descarga] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /^pdf$/i }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/\.pdf$/);
});
