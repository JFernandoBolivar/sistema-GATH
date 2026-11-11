import { test, expect, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";

/**
 * Carnetización: armazón, Consola de Emisión (búsqueda y parámetros), plantillas
 * y estadísticas.
 *
 * Las pantallas se unificaron en la Consola de Emisión (O51): `/carnetizacion`
 * redirige a `/carnetizacion/emision`, y `/carnetizacion/buscar` y
 * `/carnetizacion/generar` renderizan la misma consola. La spec comprueba esa
 * interfaz; no emite carnets para no alterar datos de la base local.
 */
const CEDULA = "30540767";
const NOMBRE = "HITLER MOISES MACHADO CORRO";

async function login(page: Page) {
  await iniciarSesionE2E(page);
}

test.describe("Carnetización UI - Consola de emisión, plantillas y estadísticas", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("1. /carnetizacion abre la Consola de Emisión con su armazón y sidebar", async ({ page }) => {
    // La consola mantiene peticiones largas abiertas; `load` no llega a dispararse
    // de forma fiable en el entorno local.
    await page.goto("/carnetizacion", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/carnetizacion\/emision/);

    // Armazón
    await expect(
      page.locator("header").getByRole("heading", { name: "Sistema de Carnetización" }),
    ).toBeVisible();
    await expect(
      page.getByText("Generación y Gestión de Carnets del Personal - CONATEL"),
    ).toBeVisible();
    await expect(page.locator("img[alt='Logo CONATEL']")).toBeVisible();

    // Sidebar
    await expect(page.getByRole("link", { name: "Inicio" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Carnets" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Consola de Emisión" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Estadísticas" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Plantillas" })).toBeVisible();

    // Consola
    await expect(
      page.getByRole("heading", { name: "Consola de Emisión de Credenciales" }),
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: /buscar personal para emisión de carnet/i }),
    ).toBeVisible();
  });

  test("2. la consola busca por cédula y muestra los parámetros de emisión del titular", async ({
    page,
  }) => {
    await page.goto("/carnetizacion/emision", { waitUntil: "domcontentloaded" });
    // Espera la hidratación: si se escribe antes, React reinicia el input
    // controlado al montar y la búsqueda nunca se dispara.
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

    const buscador = page.getByRole("searchbox", {
      name: /buscar personal para emisión de carnet/i,
    });
    await buscador.fill(CEDULA);
    await expect(buscador).toHaveValue(CEDULA);

    const resultado = page.getByRole("button").filter({ hasText: NOMBRE }).first();
    await expect(resultado).toBeVisible({ timeout: 30_000 });
    await resultado.click();

    await expect(page.getByRole("heading", { level: 3, name: NOMBRE })).toBeVisible();
    await expect(page.getByText(`C.I. V-${CEDULA}`).first()).toBeVisible();
    await expect(page.getByText("Parámetros de Emisión Oficial")).toBeVisible();
    await expect(page.getByRole("combobox", { name: /motivo de emisión/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /emitir y descargar pdf/i }),
    ).toBeVisible();
    // La vista previa puede ser una imagen o una tarjeta dibujada en el DOM
    // según la plantilla; el nombre del titular dentro de la vista previa es el
    // ancla estable.
    await expect(page.getByText("Vista Previa Oficial")).toBeVisible();
    await expect(page.getByRole("heading", { level: 4, name: NOMBRE })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("3. /carnetizacion/buscar y /carnetizacion/generar abren la misma consola", async ({
    page,
  }) => {
    for (const ruta of ["/carnetizacion/buscar", `/carnetizacion/generar?cedula=${CEDULA}`]) {
      await page.goto(ruta, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: "Consola de Emisión de Credenciales" }),
      ).toBeVisible();
      await expect(
        page.getByRole("searchbox", { name: /buscar personal para emisión de carnet/i }),
      ).toBeVisible();
    }
  });

  test("4. /carnetizacion/plantillas muestra el motor de plantillas y sus pestañas", async ({
    page,
  }) => {
    await page.goto("/carnetizacion/plantillas", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Plantillas de Carnet" })).toBeVisible();
    await expect(
      page.getByText(/motor institucional de plantillas de carnet/i),
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: /plantillas por capas/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /fondos fijos/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /biblioteca de medios/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /registro de campos/i })).toBeVisible();

    // Existe al menos una plantilla con su acción de edición.
    await expect(page.getByRole("link", { name: /^editar$/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("5. /carnetizacion/estadisticas muestra tarjetas de métricas y tabla de últimos carnets", async ({
    page,
  }) => {
    await page.goto("/carnetizacion/estadisticas", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Estadísticas de Carnetización" }),
    ).toBeVisible();
    await expect(
      page.getByText("Resumen de carnets generados y métricas de uso del sistema"),
    ).toBeVisible();

    // Tarjetas métricas
    await expect(page.getByText("Total Carnets")).toBeVisible();
    await expect(page.getByText("Carnets Activos")).toBeVisible();
    await expect(page.getByText("Generados Hoy")).toBeVisible();
    await expect(page.getByText("Este Mes")).toBeVisible();

    // Tabla
    await expect(page.getByText("Últimos Carnets Generados")).toBeVisible();
  });
});
