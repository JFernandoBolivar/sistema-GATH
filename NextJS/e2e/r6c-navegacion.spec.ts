import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * R-6c (corrección): los cuatro módulos comparten el shell anterior de
 * Administración/Personal/Carnetización. «Inicio» del sidebar va a /dashboard,
 * salvo el perfil que solo tiene Autogestión, que vuelve a /autogestion.
 */
const TRAB_EMAIL = process.env.E2E_TRAB_EMAIL;
const TRAB_PASSWORD = process.env.E2E_TRAB_PASSWORD;
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL;
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD;
const PASIVO_EMAIL = process.env.E2E_PASIVO_EMAIL;
const PASIVO_PASSWORD = process.env.E2E_PASIVO_PASSWORD;
const ADMIN_CONFIGURADO = Boolean(EMAIL && PASSWORD && PASSWORD !== "COMPLETAR");

const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1366, height: 800 } },
  { nombre: "movil", viewport: { width: 390, height: 844 } },
] as const;

async function revisarPagina(
  page: Page,
  ruta: string,
  tituloModulo: string,
  inicioEsperado: string,
  movil: boolean,
) {
  await page.goto(ruta);
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.locator("header").first()).toContainText(tituloModulo);

  if (movil) {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  }
  const inicio = page.getByRole("link", { name: "Inicio", exact: true }).first();
  await expect(inicio).toBeVisible();
  await expect(inicio).toHaveAttribute("href", inicioEsperado);
  if (movil) await page.keyboard.press("Escape");

  const desborde = await page.evaluate(() => ({
    ancho: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(desborde.scroll, `${ruta} no debe desbordar a lo ancho`).toBeLessThanOrEqual(
    desborde.ancho + 1,
  );
}

async function recorrer(
  page: Page,
  email: string,
  password: string,
  rutas: ReadonlyArray<readonly [string, string]>,
  inicioEsperado: string,
) {
  test.setTimeout(300_000);
  await page.setViewportSize(VISTAS[0].viewport);
  await iniciarSesionComo(page, email, password);
  for (const { viewport } of VISTAS) {
    await page.setViewportSize(viewport);
    for (const [ruta, titulo] of rutas) {
      await revisarPagina(page, ruta, titulo, inicioEsperado, viewport.width < 768);
    }
  }
}

test.describe("R-6c — ADMINISTRADOR", () => {
  test.skip(!ADMIN_CONFIGURADO, "E2E_ADMIN_PASSWORD no configurada (marcador local)");
  test("mismo shell en Administración, Gestión, Carnetización y Autogestión", async ({ page }) => {
    await recorrer(
      page,
      EMAIL,
      PASSWORD,
      [
        ["/usuarios", "Administración del sistema"],
        ["/personal", "Gestión Administrativa de Talento Humano"],
        ["/carnetizacion", "Sistema de Carnetización"],
        ["/autogestion", "Autogestión de Personal"],
      ],
      "/dashboard",
    );
  });
});

test.describe("R-6c — trabajador ACTIVO", () => {
  test.skip(!TRAB_EMAIL || !TRAB_PASSWORD, "faltan las credenciales E2E del trabajador");
  test("Autogestión comparte shell; Inicio vuelve a /autogestion", async ({ page }) => {
    await recorrer(
      page,
      TRAB_EMAIL as string,
      TRAB_PASSWORD as string,
      [["/autogestion", "Autogestión de Personal"]],
      "/autogestion",
    );
  });
});

test.describe("R-6c — Bienestar", () => {
  test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "faltan las credenciales E2E de Bienestar");
  test("Gestión de Trabajadores mantiene shell e Inicio /dashboard", async ({ page }) => {
    await recorrer(
      page,
      BIEN_EMAIL as string,
      BIEN_PASSWORD as string,
      [
        ["/personal", "Gestión Administrativa de Talento Humano"],
        ["/personal/consultar", "Gestión Administrativa de Talento Humano"],
      ],
      "/dashboard",
    );
  });
});

test.describe("R-6c — pasivo", () => {
  test.skip(!PASIVO_EMAIL || !PASIVO_PASSWORD, "faltan las credenciales E2E del pasivo");
  test("Autogestión comparte shell; Inicio vuelve a /autogestion", async ({ page }) => {
    await recorrer(
      page,
      PASIVO_EMAIL as string,
      PASIVO_PASSWORD as string,
      [["/autogestion", "Autogestión de Personal"]],
      "/autogestion",
    );
  });
});
