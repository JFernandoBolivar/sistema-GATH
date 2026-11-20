import { expect, test } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Ciclo físico del carnet en la consola (seguimiento B-5): emitir → marcar impreso → registrar
 * entrega → anular con motivo.
 *
 * Opcional: solo corre con E2E_CICLO_CARNET=1 porque EMITE un carnet real. Usa la cédula de
 * E2E_CICLO_CEDULA (un titular de prueba con asignación vigente o pasivo, sin carnet activo).
 */
const CEDULA = process.env.E2E_CICLO_CEDULA ?? "";
test.skip(process.env.E2E_CICLO_CARNET !== "1" || !CEDULA, "Requiere E2E_CICLO_CARNET=1 y E2E_CICLO_CEDULA.");

test("emitir, imprimir, entregar y anular un carnet desde la consola", async ({ page }) => {
  page.setDefaultTimeout(30_000);
  await iniciarSesionComo(page, EMAIL, PASSWORD);
  await page.goto("/carnetizacion/emision");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("searchbox", { name: /buscar personal para emisión de carnet/i }).fill(CEDULA);
  await page.getByRole("button").filter({ hasText: CEDULA }).first().click();

  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: /emitir y descargar pdf/i }).click();
  await descarga;
  await expect(page.getByText(/pendiente de impresión/i)).toBeVisible();

  await page.getByRole("button", { name: /marcar impreso/i }).click();
  await expect(page.getByText(/listo para entregar/i)).toBeVisible();

  await page.getByRole("button", { name: /registrar entrega/i }).click();
  await page.getByLabel(/recibido por/i).fill("Titular de prueba E2E");
  await page.getByRole("dialog").getByRole("button", { name: /registrar entrega/i }).click();
  await expect(page.getByText(/entregado al titular/i)).toBeVisible();

  await page.getByRole("button", { name: /anular carnet/i }).click();
  const anular = page.getByRole("dialog").getByRole("button", { name: /anular carnet/i });
  await expect(anular).toBeDisabled(); // sin motivo no se anula
  await page.getByLabel(/motivo de la anulación/i).fill("Prueba E2E del ciclo físico");
  await anular.click();
  await expect(page.getByText(/sin carnet vigente emitido/i)).toBeVisible();
});
