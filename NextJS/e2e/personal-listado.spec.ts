import { expect, test } from "@playwright/test";

import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Mensaje 1b: el listado de activos pide página por página al servidor.
 * Solo lectura con la cuenta de Bienestar (personal.ver).
 */
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL ?? "";
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD ?? "";

test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "Faltan E2E_BIEN_EMAIL/E2E_BIEN_PASSWORD.");

const FILAS = "#contenido-principal table tbody tr";

async function abrirListado(page: import("@playwright/test").Page) {
  await iniciarSesionComo(page, BIEN_EMAIL, BIEN_PASSWORD);
  await page.goto("/personal/consultar");
  await expect(page.locator(FILAS).first()).toBeVisible({ timeout: 60_000 });
}

test("la tabla pide la siguiente página al servidor", async ({ page }) => {
  await abrirListado(page);

  const primeraAntes = (await page.locator(FILAS).first().innerText()).trim();
  expect(await page.locator(FILAS).count()).toBe(10);

  await page.getByRole("button", { name: /siguiente/i }).click();

  await expect
    .poll(async () => (await page.locator(FILAS).first().innerText()).trim(), {
      timeout: 30_000,
    })
    .not.toBe(primeraAntes);
  expect(await page.locator(FILAS).count()).toBeGreaterThan(0);
});

test("filtrar por cédula y limpiar", async ({ page }) => {
  await abrirListado(page);

  const cedula = (await page.locator(`${FILAS} td`).first().innerText()).trim();

  await page.getByLabel(/buscar cédula/i).fill(cedula);
  await page.getByRole("button", { name: /^buscar/i }).click();

  await expect(page.locator(FILAS)).toHaveCount(1);
  await expect(page.locator(FILAS).first()).toContainText(cedula);

  await page.getByRole("button", { name: /limpiar/i }).click();
  await expect(page.locator(FILAS)).toHaveCount(10);
});

test("buscar por nombre y aceptar acentos en la búsqueda", async ({ page }) => {
  await abrirListado(page);

  const fila = page.locator(FILAS).first();
  const celdas = fila.locator("td");
  const nombres = (await celdas.nth(1).innerText()).trim();
  const fragmento = nombres.split(" ")[0];

  await page.getByLabel(/buscar cédula/i).fill(fragmento);
  await page.getByRole("button", { name: /^buscar/i }).click();
  await expect(page.locator(FILAS).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(FILAS).first()).toContainText(fragmento);

  // Una búsqueda con acentos no rompe la pantalla: responde sin resultados o
  // con coincidencias, pero siempre con la tabla en un estado válido.
  await page.getByLabel(/buscar cédula/i).fill("PÉREZ");
  await page.getByRole("button", { name: /^buscar/i }).click();
  const filaConDatos = page
    .locator(FILAS)
    .filter({ hasNotText: "Sin empleados." })
    .first();
  await expect(
    filaConDatos.or(page.getByText("Sin empleados.")),
  ).toBeVisible({ timeout: 30_000 });
});
