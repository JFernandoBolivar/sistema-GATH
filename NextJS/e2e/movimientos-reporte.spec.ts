import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * G6 (auditoría de Gestión de Trabajadores, 2026-10-29) en vivo:
 *
 *  - Los filtros del historial se validan también en el backend (RN-008-01) y
 *    el listado se pagina en el servidor (10 por defecto, tope 50).
 *  - El PDF y el Excel se descargan desde la pantalla con los filtros
 *    aplicados y exponen las cabeceras `X-Reporte-*` de truncado.
 *  - Cuando el documento alcanza el tope de filas, la UI lo avisa.
 *
 * El backend se consulta directo (E2E_DJANGO_URL, por defecto el 8001 del
 * compose) para comprobar filtros y totales sin depender de los datos locales.
 */
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";

interface PaginaMovimientos {
  resultados: Array<{ empleado_cedula: string; tipo_movimiento: string }>;
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

async function tokenDeAcceso(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name === "dj_access")?.value;
  expect(token, "la sesión debe tener la cookie dj_access").toBeTruthy();
  return token as string;
}

async function consultar(page: Page, query = ""): Promise<PaginaMovimientos> {
  const respuesta = await page.request.get(`${DJANGO}/api/v1/movimientos/${query}`, {
    headers: { Authorization: `Bearer ${await tokenDeAcceso(page)}` },
  });
  expect(respuesta.status(), `GET /api/v1/movimientos/${query}`).toBe(200);
  return ((await respuesta.json()) as { data: PaginaMovimientos }).data;
}

async function abrirHistorial(page: Page) {
  await page.goto("/movimientos");
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.getByRole("heading", { name: /Movimientos/i }).first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("Reporte de movimientos (G6)", () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesionComo(page, EMAIL, PASSWORD);
    await abrirHistorial(page);
  });

  test("G6: el listado se pagina en el servidor y el tope de página es 50", async ({ page }) => {
    const primera = await consultar(page, "?pagina=1&page_size=10");
    expect(primera.pagina).toBe(1);
    expect(primera.tamano).toBe(10);
    expect(primera.resultados.length).toBeLessThanOrEqual(10);

    const sinTope = await consultar(page, "?pagina=1&page_size=500");
    expect(sinTope.tamano).toBe(50);

    if (primera.total > 10) {
      const segunda = await consultar(page, "?pagina=2&page_size=10");
      expect(segunda.pagina).toBe(2);
      const idsPrimera = new Set(primera.resultados.map((m) => `${m.empleado_cedula}|${m.tipo_movimiento}`));
      expect(
        segunda.resultados.every((m) => !idsPrimera.has(`${m.empleado_cedula}|${m.tipo_movimiento}`)),
      ).toBe(true);
    }
  });

  test("G6: la pantalla aplica filtros y muestra el total y la paginación", async ({ page }) => {
    const general = await consultar(page, "?pagina=1&page_size=10");

    await page.getByRole("button", { name: /^Buscar/ }).click();

    const badge = page.getByText(/movimiento\(s\) · página \d+ de \d+/);
    await expect(badge).toBeVisible({ timeout: 20_000 });
    await expect(badge).toContainText(`${general.total} movimiento(s)`);
    await expect(page.getByText(/^Página \d+ de \d+$/).last()).toBeVisible();

    if (general.total > 10) {
      const siguiente = page.getByRole("button", { name: "Siguiente" }).first();
      await expect(siguiente).toBeEnabled();
      await siguiente.click();
      await expect(badge).toContainText("página 2 de", { timeout: 20_000 });
    }

    // Filtro por cédula: el backend devuelve solo ese trabajador.
    const cedula = general.resultados[0]?.empleado_cedula;
    test.skip(!cedula, "la BD local no tiene movimientos registrados");

    const filtrado = await consultar(page, `?cedula=${encodeURIComponent(cedula as string)}`);
    expect(filtrado.total).toBeGreaterThan(0);
    expect(filtrado.resultados.every((m) => m.empleado_cedula === cedula)).toBe(true);
    expect(filtrado.total).toBeLessThanOrEqual(general.total);
  });

  test("G6: RN-008-01 se valida en el backend (400, no una lista vacía)", async ({ page }) => {
    const respuesta = await page.request.get(
      `${DJANGO}/api/v1/movimientos/?fecha_inicio=2026-12-31&fecha_fin=2026-01-01`,
      { headers: { Authorization: `Bearer ${await tokenDeAcceso(page)}` } },
    );

    expect(respuesta.status()).toBe(400);
    expect(JSON.stringify(await respuesta.json())).toContain("posterior");
  });

  test("G6: el PDF se descarga con los filtros y las cabeceras de tope", async ({ page }) => {
    test.setTimeout(120_000);
    await page.getByRole("button", { name: /^Buscar/ }).click();
    await expect(page.getByText(/movimiento\(s\) · página \d+ de \d+/)).toBeVisible({
      timeout: 20_000,
    });

    const respuestaPdf = page.waitForResponse(
      (r) => r.url().includes("/api/movimientos/pdf") && r.request().method() === "GET",
      { timeout: 60_000 },
    );
    const descarga = page.waitForEvent("download", { timeout: 60_000 });

    await page.getByRole("button", { name: /Descargar PDF/i }).click();

    const [respuesta, archivo] = await Promise.all([respuestaPdf, descarga]);
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()["content-type"]).toContain("application/pdf");
    expect(respuesta.headers()["x-reporte-truncado"]).toMatch(/^(true|false)$/);
    expect(Number(respuesta.headers()["x-reporte-limite"])).toBeGreaterThan(0);
    expect(archivo.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test("G6: el Excel se descarga con los mismos filtros", async ({ page }) => {
    await page.getByRole("button", { name: /^Buscar/ }).click();
    await expect(page.getByText(/movimiento\(s\) · página \d+ de \d+/)).toBeVisible({
      timeout: 20_000,
    });

    const respuestaExcel = page.waitForResponse(
      (r) => r.url().includes("/api/movimientos/excel") && r.request().method() === "GET",
      { timeout: 60_000 },
    );
    const descarga = page.waitForEvent("download", { timeout: 60_000 });

    await page.getByRole("button", { name: /Descargar Excel/i }).click();

    const [respuesta, archivo] = await Promise.all([respuestaExcel, descarga]);
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()["content-type"]).toContain("spreadsheetml");
    expect(respuesta.headers()["x-reporte-truncado"]).toMatch(/^(true|false)$/);
    expect(archivo.suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test("G6: la UI avisa cuando el documento llega al tope de filas", async ({ page }) => {
    await page.getByRole("button", { name: /^Buscar/ }).click();
    await expect(page.getByText(/movimiento\(s\) · página \d+ de \d+/)).toBeVisible({
      timeout: 20_000,
    });

    await page.route("**/api/movimientos/pdf*", (route) =>
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

    await page.getByRole("button", { name: /Descargar PDF/i }).click();

    const aviso = page.getByRole("status").filter({ hasText: /tope de/i });
    await expect(aviso).toContainText(/tope de 5\.000 filas/i, { timeout: 20_000 });
    await expect(aviso).toContainText(/6\.123 registros/i);
  });
});
