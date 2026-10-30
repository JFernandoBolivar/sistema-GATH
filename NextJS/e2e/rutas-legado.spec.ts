import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * G7 (auditoría de Gestión de Trabajadores, 2026-10-29): el shell legado
 * `src/app/(protected)/dashboard` se retiró. Sus enlaces y marcadores siguen
 * funcionando porque `/dashboard` redirige a `/inicio`, y las páginas que
 * dependían de sus helpers (el censo de vivienda) usan ahora el módulo
 * `personal`.
 */
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";

async function tokenDeAcceso(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name === "dj_access")?.value;
  expect(token).toBeTruthy();
  return token as string;
}

test.describe("G7: rutas del shell legado", () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesionComo(page, EMAIL, PASSWORD);
  });

  test("«/dashboard» redirige a «/inicio» y el inicio muestra los módulos", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL((url) => url.pathname === "/inicio", { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /Sistema de Información Integral/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Movimientos/i })).toBeVisible();
  });

  test("el censo de vivienda sigue funcionando con el módulo personal", async ({ page }) => {
    // Cédula real tomada del historial de movimientos (sin hardcodear cuentas E2E).
    const respuesta = await page.request.get(`${DJANGO}/api/v1/movimientos/?page_size=1`, {
      headers: { Authorization: `Bearer ${await tokenDeAcceso(page)}` },
    });
    expect(respuesta.status()).toBe(200);
    const cedula = ((await respuesta.json()) as {
      data: { resultados: Array<{ empleado_cedula: string }> };
    }).data.resultados[0]?.empleado_cedula;
    test.skip(!cedula, "la BD local no tiene movimientos registrados");

    await page.goto("/censo-vivienda");
    await expect(page.getByLabel(/Buscar Trabajador por Cédula/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel(/Buscar Trabajador por Cédula/i).fill(cedula as string);
    await page.getByRole("button", { name: /^Buscar/ }).click();

    await expect(page.getByText("DATOS DEL TRABAJADOR")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(/Buscar Trabajador por Cédula/i)).toHaveValue(cedula as string);
  });

  test("los módulos que colgaban del shell legado siguen abriendo", async ({ page }) => {
    for (const [ruta, texto] of [
      ["/personal", /Bienvenid@ a GATH/i],
      ["/movimientos", /Consulta De Movimientos De Trabajadores/i],
    ] as const) {
      await page.goto(ruta);
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page.getByText(texto).first()).toBeVisible({ timeout: 20_000 });
      expect(new URL(page.url()).pathname).toBe(ruta);
    }
  });
});
