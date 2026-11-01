import { expect, test, type Page } from "@playwright/test";

import { iniciarSesionComo } from "./inicio-sesion";

/**
 * G13 — Gestión de Personal Pasivo y navegación sin saltos.
 *
 * Con la cuenta de Bienestar se prueban lectura, detalle, familiares, menús y
 * selector. Las acciones de alta/edición requieren `pasivos.crear`/`editar`;
 * si `E2E_ADMIN_PASSWORD` está configurada se ejecutan, si no se omiten.
 * No crea ni borra datos cuando solo hay credenciales de Bienestar.
 */
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL ?? "";
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD ?? "";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const hayBien = Boolean(BIEN_EMAIL && BIEN_PASSWORD) && BIEN_PASSWORD !== "COMPLETAR";
const hayAdmin = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD) && ADMIN_PASSWORD !== "COMPLETAR";

async function loginBien(page: Page) {
  await iniciarSesionComo(page, BIEN_EMAIL, BIEN_PASSWORD);
}

async function loginAdmin(page: Page) {
  await iniciarSesionComo(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

test.describe("G13 — Pasivos y navegación", () => {
  test.skip(!hayBien, "Faltan E2E_BIEN_EMAIL/E2E_BIEN_PASSWORD.");

  test("el selector abre el listado de pasivos con su sidebar", async ({ page }) => {
    await loginBien(page);
    await page.goto("/pasivos");
    await expect(page).toHaveURL(/\/pasivos\/consultar/);
    await expect(page.getByRole("heading", { name: "Consultar Pasivo" })).toBeVisible();
    await expect(page.getByText("Personal Pasivo", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Consultar/Actualizar" })).toBeVisible();
    await expect(page.getByLabel("Cédula")).toBeVisible();
    await expect(page.getByLabel("Nombre")).toBeVisible();
    await expect(page.getByLabel("Tipo de nómina")).toBeVisible();
  });

  test("lista paginada y detalle de un pasivo existente", async ({ page }) => {
    await loginBien(page);
    await page.goto("/pasivos/consultar");
    await expect(page.getByRole("table")).toBeVisible();

    const primeraFila = page.getByRole("row").nth(1);
    await primeraFila.getByRole("button", { name: /abrir menú/i }).click();
    await page.getByRole("menuitem", { name: /ver detalle/i }).click();
    await expect(page.getByRole("heading", { name: /expediente/i })).toBeVisible();
    await expect(page.getByText(/Cédula:/)).toBeVisible();
  });

  test("familiares se consulta filtrando por pasivo", async ({ page }) => {
    await loginBien(page);
    await page.goto("/familiares/consultar?pasivo=1");
    await expect(page.getByLabel("Pasivo")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Consultar Familiar" })).toBeVisible();
  });

  test("el selector cambia entre activos y pasivos", async ({ page }) => {
    await loginBien(page);
    await page.goto("/personal");
    const selector = page.getByRole("button", { name: /gestion personal activo/i });
    await expect(selector).toBeVisible();
    await selector.click();
    await page.getByRole("menuitem", { name: /gestión de personal pasivo/i }).click();
    await expect(page).toHaveURL(/\/pasivos\/consultar/);
    await expect(page.getByText("Personal Pasivo", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /gestion personal pasivo/i }).click();
    await page.getByRole("menuitem", { name: /gestión de personal activo/i }).click();
    await expect(page).toHaveURL(/\/personal$/);
  });

  test("menú de activos conserva sus submódulos y no muestra Autogestión/Configuración visual", async ({ page }) => {
    await loginBien(page);
    await page.goto("/personal");
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByText("Personal Trabajador")).toBeVisible();
    await expect(sidebar.getByText("Actualización de Datos")).toBeVisible();
    await expect(sidebar.getByText("Fe de vida")).toBeVisible();
    await expect(sidebar.getByText("Censo de Vivienda")).toBeVisible();
    await expect(sidebar.getByText("Configuración visual")).toHaveCount(0);
    await expect(sidebar.getByText("Autogestión", { exact: true })).toHaveCount(0);
  });

  test("no hay textos con acentos dañados en el sidebar", async ({ page }) => {
    await loginBien(page);
    await page.goto("/personal");
    const texto = (await page.locator("[data-sidebar='sidebar']").innerText()).toLowerCase();
    for (const roto of ["pr?rrogas", "m?tricas", "revisi?n", "actualizaci?n", "c?dula", "n?mina"]) {
      expect(texto, `Texto dañado: ${roto}`).not.toContain(roto);
    }
  });

  test("las rutas viejas del censo redirigen a Gestión de Trabajadores", async ({ page }) => {
    await loginBien(page);
    await page.goto("/autogestion/consultar");
    await expect(page).toHaveURL(/\/personal\/censo\/respuestas/);
    await page.goto("/autogestion/metricas");
    await expect(page).toHaveURL(/\/personal\/censo\/metricas/);
  });
});

test.describe("G13 — Alta directa y edición (requiere permisos de escritura)", () => {
  test.skip(!hayAdmin, "Falta E2E_ADMIN_PASSWORD para probar alta/edición.");

  test("el menú de activos recupera todos los submódulos de HEAD", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/personal");
    const sidebar = page.locator("[data-sidebar='sidebar']");
    for (const texto of [
      "Personal Trabajador",
      "Ub. Administrativas",
      "Gestión De Codigos",
      "Movimientos",
      "Reportes",
      "Retroalimentación",
      "Actualización de Datos",
      "Fe de vida",
      "Censo de Vivienda",
    ]) {
      await expect(sidebar.getByText(texto, { exact: true }).first()).toBeVisible();
    }
    await expect(sidebar.getByText("Configuración visual")).toHaveCount(0);
    await expect(sidebar.getByText("Autogestión", { exact: true })).toHaveCount(0);
  });

  test("el menú de pasivos muestra Egreso de pasivo y no opciones de activos", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/pasivos/consultar");
    const sidebar = page.locator("[data-sidebar='sidebar']");
    await expect(sidebar.getByRole("link", { name: "Agregar Pasivo" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Egreso de pasivo" })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Procesar egreso" })).toHaveCount(0);
    await expect(sidebar.getByRole("link", { name: /Alta de pensión por sobreviviente/ })).toHaveCount(0);
  });
});
