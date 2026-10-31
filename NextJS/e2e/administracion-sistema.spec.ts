import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * D9/D10 en vivo: renombre de «Administración del sistema», parámetros editables
 * que se aplican sin reiniciar, bitácora con filtros, detalle antes/después,
 * exportación y permisos.
 */
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";
const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL;
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD;
const CLAVE_RECORDATORIOS = "fe_de_vida.dias_recordatorio";
const RECORDATORIOS_DEFECTO = "30,15,7,3,1";

async function tokenDeAcceso(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const token = cookies.find((c) => c.name === "dj_access")?.value;
  expect(token).toBeTruthy();
  return token as string;
}

async function guardarParametro(page: Page, clave: string, valor: string) {
  await page.goto("/configuracion/parametros");
  await page.waitForLoadState("networkidle").catch(() => {});
  const fila = page.locator(`[data-parametro="${clave}"]`);
  await expect(fila).toBeVisible({ timeout: 20_000 });
  const campo = fila.getByRole("textbox").or(fila.getByRole("spinbutton"));
  await campo.fill(valor);
  await fila.getByRole("button", { name: /^Guardar/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("[data-sonner-toast]")).toContainText(/actualizado/i, {
    timeout: 20_000,
  });
}

test.describe("D9: Administración del sistema", () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesionComo(page, EMAIL, PASSWORD);
  });

  test("el módulo se llama «Administración del sistema» y conserva las rutas", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page.getByRole("link", { name: /Administración del sistema/i })).toBeVisible();

    await page.goto("/usuarios");
    await expect(page.getByRole("heading", { name: /Administración del sistema/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Usuarios y roles");
    await expect(page.getByRole("button", { name: /Usuarios y roles/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Configuración/i })).toBeVisible();

    await page.goto("/configuracion");
    await expect(page.getByRole("link", { name: /Parámetros del sistema/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Identidad visual/i })).toBeVisible();
    await expect(page.getByText(/Documentos por movimiento/i).first()).toBeVisible();
    await expect(page.getByText(/Espacio reservado/i)).toBeVisible();
  });

  test("editar un parámetro se aplica sin reiniciar y se restaura", async ({ page }) => {
    test.setTimeout(180_000);
    try {
      await guardarParametro(page, CLAVE_RECORDATORIOS, "12,4");

      // Efecto sin reinicio: el formulario de procesos lee los días del servidor.
      await page.goto("/personal/fe-de-vida/procesos");
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.getByRole("button", { name: /Nuevo proceso/i }).click();
      await expect(page.getByRole("button", { name: /12 d[ií]as antes/i })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole("button", { name: /4 d[ií]as antes/i })).toBeVisible();

      const token = await tokenDeAcceso(page);
      const api = await page.request.get(
        `${DJANGO}/api/v1/configuracion/parametros/recordatorios-fe-de-vida/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(api.status()).toBe(200);
      expect((await api.json()).data.dias).toEqual([12, 4]);
    } finally {
      await guardarParametro(page, CLAVE_RECORDATORIOS, RECORDATORIOS_DEFECTO);
    }
  });
});

test.describe("D10: bitácora de auditoría", () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesionComo(page, EMAIL, PASSWORD);
  });

  test("filtra, abre el detalle antes/después y exporta PDF y Excel", async ({ page }) => {
    test.setTimeout(240_000);
    // Genera un cambio conocido en la bitácora (y lo restaura al final).
    await guardarParametro(page, "plazos.password_inicial_dias", "8");
    try {
      await page.goto("/auditoria");
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page.getByRole("heading", { name: /Bitácora de auditoría/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /Bitácora/i })).toBeVisible();

      await page.getByLabel("Módulo").selectOption("configuracion");
      await page.getByLabel("Acción").selectOption("configuracion.parametro_actualizado");
      await page.getByRole("button", { name: /^Filtrar/ }).click();
      await expect(page.getByRole("table").first()).toContainText("configuracion.parametro_actualizado", {
        timeout: 20_000,
      });

      await page.getByRole("button", { name: /Ver detalle/i }).first().click();
      const dialogo = page.getByRole("dialog").filter({ hasText: /Detalle del registro/i });
      await expect(dialogo).toContainText("Campos que cambiaron", { timeout: 20_000 });
      await expect(dialogo).toContainText("Antes");
      await expect(dialogo).toContainText("Después");
      await page.keyboard.press("Escape");
      await expect(dialogo).toHaveCount(0);

      const descargaPdf = page.waitForEvent("download", { timeout: 60_000 });
      await page.getByRole("button", { name: /Exportar PDF/i }).click();
      expect((await descargaPdf).suggestedFilename()).toMatch(/\.pdf$/);

      const descargaExcel = page.waitForEvent("download", { timeout: 60_000 });
      await page.getByRole("button", { name: /Exportar Excel/i }).click();
      expect((await descargaExcel).suggestedFilename()).toMatch(/\.xlsx$/);
    } finally {
      await guardarParametro(page, "plazos.password_inicial_dias", "7");
    }
  });

  test("un perfil sin auditoría no ve la bitácora", async ({ page }) => {
    test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "faltan las credenciales E2E de Bienestar");
    // El beforeEach dejó la sesión del administrador: se limpia para entrar con Bienestar.
    await page.context().clearCookies();
    await iniciarSesionComo(page, BIEN_EMAIL as string, BIEN_PASSWORD as string);
    await page.goto("/auditoria");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByText(/No tiene el permiso/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /Exportar PDF/i })).toHaveCount(0);
  });
});
