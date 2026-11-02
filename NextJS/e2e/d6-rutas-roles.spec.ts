import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * D6 — regresión rol → rutas/opciones con las cuentas E2E existentes:
 *   - ADMINISTRADOR: E2E_ADMIN_*
 *   - AUTOGESTION ACTIVO: E2E_TRAB_*
 *   - ANALISTA_BIENESTAR (SIN_ASIGNACION): E2E_BIEN_*
 *   - AUTOGESTION PASIVO: E2E_PASIVO_*
 *
 * No se modifican roles, permisos ni contraseñas de estas cuentas: solo se
 * comprueba lo que la sesión ya permite. La autorización real sigue en Django.
 */
const TRAB_EMAIL = process.env.E2E_TRAB_EMAIL;
const TRAB_PASSWORD = process.env.E2E_TRAB_PASSWORD;
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL;
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD;
const PASIVO_EMAIL = process.env.E2E_PASIVO_EMAIL;
const PASIVO_PASSWORD = process.env.E2E_PASIVO_PASSWORD;
/**
 * La contraseña del administrador E2E aún es el marcador del archivo local
 * (`COMPLETAR`). No se toca la cuenta: el caso se omite y se reporta.
 */
const ADMIN_CONFIGURADO = Boolean(EMAIL && PASSWORD && PASSWORD !== "COMPLETAR");

const MODULOS = {
  admin: "Administración del sistema",
  trabajadores: "Gestión de Trabajadores",
  carnetizacion: "Carnetización",
  autogestion: "Autogestión",
} as const;

async function abrirDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await page.locator("#dashboard-modulos").waitFor({ state: "visible", timeout: 30_000 });
}

async function moduloVisible(page: Page, nombre: string): Promise<void> {
  await expect(
    page.locator("#dashboard-modulos").getByText(nombre, { exact: true }).first(),
  ).toBeVisible();
}

async function moduloOculto(page: Page, nombre: string): Promise<void> {
  await expect(page.locator("#dashboard-modulos").getByText(nombre, { exact: true })).toHaveCount(0);
}

async function rutaProhibidaRedirige(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta);
  await expect(page).toHaveURL(/\/dashboard\?aviso=sin-permiso/);
  await expect(page.locator('p[role="alert"]')).toContainText(/no tiene permiso/i);
}

test.describe("D6 — ADMINISTRADOR", () => {
  test.skip(
    !ADMIN_CONFIGURADO,
    "E2E_ADMIN_PASSWORD no configurada (marcador local); no se modifica la cuenta",
  );

  test("ve los cuatro módulos y el menú completo de administración", async ({ page }) => {
    test.setTimeout(180_000);
    await iniciarSesionComo(page, EMAIL, PASSWORD);
    await abrirDashboard(page);

    for (const nombre of Object.values(MODULOS)) await moduloVisible(page, nombre);

    await page.goto("/usuarios");
    await expect(page.getByRole("button", { name: "Usuarios" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Configuración" }).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Bitácora de auditoría" }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Usuarios" }).first().click();
    for (const opcion of [
      "Consultar usuarios",
      "Registrar usuario",
      "Consultar roles",
      "Matriz de permisos",
    ]) {
      await expect(page.getByRole("link", { name: opcion }).first()).toBeVisible();
    }
  });
});

test.describe("D6 — trabajador ACTIVO (AUTOGESTION)", () => {
  test.skip(!TRAB_EMAIL || !TRAB_PASSWORD, "faltan las credenciales E2E del trabajador");

  test("solo ve Autogestión y su menú de activo; una ruta prohibida avisa", async ({ page }) => {
    test.setTimeout(180_000);
    await iniciarSesionComo(page, TRAB_EMAIL as string, TRAB_PASSWORD as string);
    await abrirDashboard(page);

    await moduloVisible(page, MODULOS.autogestion);
    await moduloOculto(page, MODULOS.admin);
    await moduloOculto(page, MODULOS.trabajadores);
    await moduloOculto(page, MODULOS.carnetizacion);

    await page.goto("/autogestion");
    for (const opcion of ["Mi ficha", "Solicitar actualización", "Mis solicitudes", "Censo de vivienda"]) {
      await expect(page.getByRole("link", { name: opcion }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Fe de vida" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Respuestas de encuesta" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Métricas" })).toHaveCount(0);

    await rutaProhibidaRedirige(page, "/personal");
  });
});

test.describe("D6 — Bienestar (ANALISTA_BIENESTAR)", () => {
  test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "faltan las credenciales E2E de Bienestar");

  test("ve Gestión de Trabajadores y su menú; no administración ni carnetización", async ({ page }) => {
    test.setTimeout(180_000);
    await iniciarSesionComo(page, BIEN_EMAIL as string, BIEN_PASSWORD as string);
    await abrirDashboard(page);

    await moduloVisible(page, MODULOS.trabajadores);
    await moduloVisible(page, MODULOS.autogestion);
    await moduloOculto(page, MODULOS.admin);
    await moduloOculto(page, MODULOS.carnetizacion);

    await page.goto("/personal");
    for (const grupo of ["Personal Trabajador", "Fe de vida", "Bienestar Social", "Reportes"]) {
      await expect(page.getByRole("button", { name: grupo }).first()).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Organización" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Gestión De Codigos" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Movimientos" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Configuración visual" })).toHaveCount(0);

    await rutaProhibidaRedirige(page, "/usuarios");
    await rutaProhibidaRedirige(page, "/configuracion");
    await rutaProhibidaRedirige(page, "/carnetizacion");
  });
});

test.describe("D6 — pasivo (AUTOGESTION, condición PASIVO)", () => {
  test.skip(!PASIVO_EMAIL || !PASIVO_PASSWORD, "faltan las credenciales E2E del pasivo");

  test("ve Fe de vida y no las opciones de activo; una ruta de personal avisa", async ({ page }) => {
    test.setTimeout(180_000);
    await iniciarSesionComo(page, PASIVO_EMAIL as string, PASIVO_PASSWORD as string);
    await abrirDashboard(page);

    await moduloVisible(page, MODULOS.autogestion);
    await moduloOculto(page, MODULOS.admin);
    await moduloOculto(page, MODULOS.trabajadores);
    await moduloOculto(page, MODULOS.carnetizacion);

    await page.goto("/autogestion");
    await expect(page.getByRole("link", { name: "Fe de vida" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Mi ficha" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitar actualización" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Mis solicitudes" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Censo de vivienda" })).toHaveCount(0);

    await rutaProhibidaRedirige(page, "/personal");
    await rutaProhibidaRedirige(page, "/personal/fe-de-vida");
  });
});
