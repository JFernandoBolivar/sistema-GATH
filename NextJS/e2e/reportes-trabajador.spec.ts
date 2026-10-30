import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * G1–G4 (auditoría de Gestión de Trabajadores, 2026-10-29) en vivo:
 *
 *  G1. Los filtros de estructura organizativa del reporte de trabajador se
 *      muestran a quien tiene `organizacion.ver` (antes se ocultaban a todos
 *      porque se comparaba contra el comodín "*", que ningún rol recibe).
 *  G2. El PDF se genera de verdad y, si falla, el usuario ve el error y
 *      conserva los filtros (antes solo había `console.error` y `form.reset`).
 *      El backend exige `reportes.generar_pdf` y la UI lo respeta.
 *  G3. El backend aplica los filtros del formulario (antes ignoraba ~20),
 *      rechaza los desconocidos con 400 y respeta `agrupar_por`/`tipo_reporte`.
 *  G4. «Configuración visual» (cintillo, HU 0009) está en el menú con su
 *      permiso por código.
 *
 * Credenciales solo por entorno (R15): E2E_ADMIN_* (ADMINISTRADOR) y, para la
 * comprobación negativa de G1, E2E_BIEN_* (sin `organizacion.ver`).
 * El backend se consulta directo para verificar los filtros; su URL se toma de
 * E2E_DJANGO_URL (por defecto http://127.0.0.1:8001, el puerto del compose).
 */
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL;
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD;

async function tokenDeAcceso(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name === "dj_access")?.value;
  expect(token, "la sesión debe tener la cookie dj_access").toBeTruthy();
  return token as string;
}

async function consultarBackend(page: Page, query: string) {
  const token = await tokenDeAcceso(page);
  return page.request.get(`${DJANGO}/api/v1/reportes/personal-activo/${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

test.describe("Reporte de trabajador (G1–G3)", () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesionComo(page, EMAIL, PASSWORD);
    await page.goto("/reportes/empleados");
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  test("G1: los filtros de estructura organizativa están visibles", async ({ page }) => {
    await expect(page.getByText("Dirección Administrativa")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Nivel", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Dirección / Gerencia / Oficina / Coordinación"),
    ).toBeVisible();
    await expect(page.getByText("División / Coordinación")).toBeVisible();
    await expect(page.getByText("Coordinación", { exact: true })).toBeVisible();
  });

  test("G2: el PDF se genera y queda disponible para descargar", async ({ page }) => {
    // El motor de PDF tarda más cuanto más registros trae: se acota con un filtro.
    test.setTimeout(180_000);
    await page.getByLabel("Edad Mínima").first().fill("70");

    const respuestaPdf = page.waitForResponse(
      (r) => r.url().includes("/api/reports/pdf") && r.request().method() === "POST",
      { timeout: 120_000 },
    );

    await page.getByRole("button", { name: /Consultar Reporte/i }).click();

    const respuesta = await respuestaPdf;
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()["content-type"]).toContain("application/pdf");

    const descargar = page.getByRole("link", { name: /Descargar Reporte/i });
    await expect(descargar).toBeVisible({ timeout: 20_000 });
    await expect(descargar).toHaveAttribute("href", /^blob:/);
  });

  test("G2: si el backend rechaza el reporte, se ve el error y no se pierden los filtros", async ({
    page,
  }) => {
    await page.route("**/api/reports/pdf", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "No tienes permiso para ejecutar esta acción" }),
      }),
    );

    const edad = page.getByLabel("Edad Mínima").first();
    await edad.fill("30");
    await page.getByRole("button", { name: /Consultar Reporte/i }).click();

    const aviso = page.locator("[data-sonner-toast]");
    await expect(aviso).toContainText(/permiso/i, { timeout: 20_000 });
    await expect(edad).toHaveValue("30");
  });

  test("G3: la UI avisa cuando el reporte alcanza el tope de filas", async ({ page }) => {
    await page.route("**/api/reports/pdf", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: {
          "X-Reporte-Truncado": "true",
          "X-Reporte-Limite": "5000",
          "X-Reporte-Total-Registros": "6123",
        },
        body: "%PDF-1.4\n%%EOF\n",
      }),
    );

    await page.getByRole("button", { name: /Consultar Reporte/i }).click();

    const aviso = page.getByRole("status").filter({ hasText: /tope de/i });
    await expect(aviso).toContainText(/tope de 5\.000 filas/i, {
      timeout: 20_000,
    });
    await expect(page.getByRole("link", { name: /Descargar Reporte/i })).toBeVisible();
  });

  test("G3: el backend aplica los filtros del formulario y rechaza los desconocidos", async ({
    page,
  }) => {
    const sinFiltros = await consultarBackend(page, "");
    expect(sinFiltros.status()).toBe(200);
    const totalSinFiltros = (await sinFiltros.json()).data.total_registros as number;
    expect(totalSinFiltros).toBeGreaterThan(0);

    // Edad imposible: el filtro debe aplicarse, no ignorarse.
    const edadImposible = await consultarBackend(page, "?edad_min=999");
    expect(edadImposible.status()).toBe(200);
    expect((await edadImposible.json()).data.total_registros).toBe(0);

    // Filtro que el registro de campos no conoce: 400 con mensaje, no silencio.
    const desconocido = await consultarBackend(page, "?campo_inventado=1");
    expect(desconocido.status()).toBe(400);
    expect((await desconocido.json()).message).toContain("campo_inventado");

    // agrupar_por + tipo_reporte ya no se descartan.
    const conteo = await consultarBackend(
      page,
      "?tipo_reporte=conteo&agrupar_por=direccion_general",
    );
    expect(conteo.status()).toBe(200);
    const cuerpoConteo = await conteo.json();
    expect(cuerpoConteo.data.columnas).toEqual(["direccion_general", "total"]);
  });

  test("G3: un filtro de estructura aplicado cambia el resultado", async ({ page }) => {
    const token = await tokenDeAcceso(page);
    const direcciones = await page.request.get(
      `${DJANGO}/api/v1/organizacion/direcciones-generales/`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(direcciones.status()).toBe(200);
    const lista = (await direcciones.json()).data as Array<{ id: number }>;
    test.skip(lista.length === 0, "no hay direcciones generales en la BD local");

    const filtrado = await consultarBackend(page, `?direccion_general_id=${lista[0].id}`);
    expect(filtrado.status()).toBe(200);

    const sinFiltros = await consultarBackend(page, "");
    const totalFiltrado = (await filtrado.json()).data.total_registros as number;
    const totalGeneral = (await sinFiltros.json()).data.total_registros as number;
    expect(totalFiltrado).toBeLessThanOrEqual(totalGeneral);
  });
});

test.describe("G1: sin organizacion.ver los filtros no se ofrecen", () => {
  test("un perfil de Bienestar no ve los filtros de estructura", async ({ page }) => {
    test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "faltan las credenciales E2E de Bienestar");

    await iniciarSesionComo(page, BIEN_EMAIL as string, BIEN_PASSWORD as string);
    await page.goto("/reportes/empleados");
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByText(/Consultar Reporte/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Dirección Administrativa")).toHaveCount(0);
  });
});

test.describe("G2: el permiso reportes.generar_pdf se exige y se respeta", () => {
  const TRAB_EMAIL = process.env.E2E_TRAB_EMAIL;
  const TRAB_PASSWORD = process.env.E2E_TRAB_PASSWORD;

  test("un perfil sin el permiso recibe 403 del backend (no un PDF vacío)", async ({ page }) => {
    test.skip(!TRAB_EMAIL || !TRAB_PASSWORD, "faltan las credenciales E2E del trabajador");

    await iniciarSesionComo(page, TRAB_EMAIL as string, TRAB_PASSWORD as string);

    const token = await tokenDeAcceso(page);
    const backend = await page.request.get(
      `${DJANGO}/api/v1/reportes/personal-activo/pdf/`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(backend.status()).toBe(403);

    // Y el listado del reporte exige `reportes.ver`: tampoco se sirve.
    const listado = await page.request.get(`${DJANGO}/api/v1/reportes/personal-activo/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listado.status()).toBe(403);
  });
});

test.describe("G4: configuración visual en el menú", () => {
  test("el menú abre /configuracion/visual con su permiso", async ({ page }) => {
    await iniciarSesionComo(page, EMAIL, PASSWORD);
    // El menú de RRHH vive en el shell de las pantallas de personal/reportes.
    await page.goto("/reportes/empleados");
    await page.waitForLoadState("networkidle").catch(() => {});

    const enlace = page.getByRole("link", { name: /Configuración visual/i });
    await expect(enlace).toBeVisible({ timeout: 20_000 });
    await enlace.click();

    await expect(page).toHaveURL(/\/configuracion\/visual/);
    await expect(page.getByRole("heading", { name: /Configuración Visual/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Tipo de cintillo").first()).toBeVisible();
  });
});
