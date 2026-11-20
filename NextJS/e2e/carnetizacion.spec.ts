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
// Cualquier cédula sirve para comprobar que /generar?cedula= abre la consola.
const CEDULA = "30540767";
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";

interface TitularBuscado {
  cedula: string;
  nombre_completo: string;
  condicion?: string;
}

async function login(page: Page) {
  await iniciarSesionE2E(page);
}

/**
 * Un titular con la condición pedida, tomado de la misma búsqueda que usa la consola: así la
 * prueba no depende de cédulas fijas de la base local. Se salta si no hay ninguno.
 */
async function buscarTitularPorCondicion(page: Page, condicion: string): Promise<TitularBuscado> {
  const token = (await page.context().cookies()).find((c) => c.name === "dj_access")?.value;
  for (const q of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]) {
    const respuesta = await page.request.get(`${DJANGO}/api/v1/carnetizacion/buscar/`, {
      params: { q },
      headers: { Authorization: `Bearer ${token}` },
    });
    const filas = ((await respuesta.json()) as { data?: TitularBuscado[] }).data ?? [];
    const titular = filas.find((f) => f.condicion === condicion);
    if (titular) return titular;
  }
  test.skip(true, `No hay titulares con condición ${condicion} en la base de prueba.`);
  throw new Error("inalcanzable");
}

async function seleccionarEnConsola(page: Page, titular: TitularBuscado) {
  await page.goto("/carnetizacion/emision", { waitUntil: "domcontentloaded" });
  // Espera la hidratación: si se escribe antes, React reinicia el input
  // controlado al montar y la búsqueda nunca se dispara.
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  const buscador = page.getByRole("searchbox", { name: /buscar personal para emisión de carnet/i });
  await buscador.fill(titular.cedula);
  await expect(buscador).toHaveValue(titular.cedula);
  const resultado = page.getByRole("button").filter({ hasText: titular.cedula }).first();
  await expect(resultado).toBeVisible({ timeout: 30_000 });
  await resultado.click();
  await expect(
    page.getByRole("heading", { level: 3, name: titular.nombre_completo.toUpperCase() }),
  ).toBeVisible();
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

  test("2. la consola muestra la condición real y la vista previa de un titular activo", async ({
    page,
  }) => {
    const titular = await buscarTitularPorCondicion(page, "ACTIVO");
    await seleccionarEnConsola(page, titular);

    await expect(page.getByText(`C.I. V-${titular.cedula}`).first()).toBeVisible();
    await expect(page.getByText("ACTIVO", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Parámetros de Emisión Oficial")).toBeVisible();
    await expect(page.getByRole("combobox", { name: /motivo de emisión/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /emitir y descargar pdf/i })).toBeVisible();
    // La vista previa la rasteriza el backend con la plantilla con la que se emitiría.
    await expect(page.getByText("Vista Previa Oficial")).toBeVisible();
    await expect(
      page.getByRole("img", { name: `Vista previa del carnet de ${titular.nombre_completo}` }),
    ).toBeVisible({ timeout: 30_000 });
    // El reverso es el real de la plantilla (generado por el backend), no una tarjeta fija.
    await page.getByRole("button", { name: "Reverso", exact: true }).click();
    await expect(
      page.getByRole("img", { name: `Vista previa del reverso del carnet de ${titular.nombre_completo}` }),
    ).toBeVisible();
  });

  test("2b. a un titular sin asignación vigente no se le ofrece emitir carnet", async ({ page }) => {
    const titular = await buscarTitularPorCondicion(page, "SIN_ASIGNACION");
    await seleccionarEnConsola(page, titular);

    await expect(page.getByText("SIN ASIGNACIÓN", { exact: true })).toBeVisible();
    await expect(page.getByText("No se puede emitir el carnet")).toBeVisible();
    await expect(page.getByRole("button", { name: /emitir y descargar pdf/i })).toBeDisabled();
    // Ni vista previa ni tarjeta de relleno que sugiera que se puede emitir.
    await expect(page.getByText("Sin vista previa")).toBeVisible();
    await expect(page.getByLabel(/vista previa del carnet:/i)).toHaveCount(0);
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
    // B-7: la pestaña «Fondos fijos» (CarnetTemplate) se retiró; el diseño heredado es la plantilla LEGACY.
    await expect(page.getByRole("tab", { name: /fondos fijos/i })).toHaveCount(0);
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
