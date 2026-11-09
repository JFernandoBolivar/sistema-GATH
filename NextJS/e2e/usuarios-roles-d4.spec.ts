import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * D4 en vivo: listado paginado con filtros, detalle, permiso efectivo con un
 * override deny visible, matriz de permisos y un perfil sin permiso.
 *
 * Los datos del usuario desechable se pasan por entorno (nunca en el repo):
 *   E2E_D4_USUARIO_ID, E2E_D4_USUARIO_CEDULA y E2E_D4_PERMISO_DENY.
 */
const USUARIO_ID = process.env.E2E_D4_USUARIO_ID;
const USUARIO_CEDULA = process.env.E2E_D4_USUARIO_CEDULA;
const USUARIO_EMAIL = process.env.E2E_D4_USUARIO_EMAIL;
const USUARIO_PASSWORD = process.env.E2E_D4_USUARIO_PASSWORD;
const PERMISO_DENY = process.env.E2E_D4_PERMISO_DENY ?? "identidad.ver_usuarios";

async function sinViolacionesGraves(page: Page) {
  const resultado = await new AxeBuilder({ page }).analyze();
  const graves = resultado.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(graves, JSON.stringify(graves.map((v) => v.id))).toEqual([]);
}

async function efectivos(page: Page): Promise<number> {
  const texto = await page.getByText(/Permiso efectivo \(\d+\)/).first().textContent();
  const coincidencia = /\((\d+)\)/.exec(texto ?? "");
  return Number(coincidencia?.[1] ?? 0);
}

test.describe("D4: Usuarios y roles", () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesionComo(page, EMAIL, PASSWORD);
  });

  test("el listado pagina en el servidor, filtra y muestra las columnas nuevas", async ({ page }) => {
    await page.goto("/usuarios");
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByRole("heading", { name: /Usuarios y roles/i })).toBeVisible();
    await expect(page.getByLabel("Cédula")).toBeVisible();
    await expect(page.getByLabel("Nombre")).toBeVisible();
    await expect(page.getByLabel("Correo")).toBeVisible();
    await expect(page.getByLabel("Rol")).toBeVisible();
    await expect(page.getByLabel("Estado")).toBeVisible();
    await expect(page.getByLabel("Condición")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Correo de acceso" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Último acceso" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Contraseña inicial" })).toBeVisible();
    await expect(page.getByText(/^Página 1 de \d+$/)).toBeVisible();

    test.skip(!USUARIO_CEDULA, "sin cédula desechable para probar el filtro");
    await page.getByLabel("Cédula").fill(USUARIO_CEDULA as string);
    await page.getByRole("button", { name: /^Filtrar/ }).click();
    await expect(page.getByRole("cell", { name: USUARIO_CEDULA as string })).toBeVisible({
      timeout: 20_000,
    });

    await sinViolacionesGraves(page);
  });

  test("el detalle muestra rol, estado, correo de acceso y el permiso efectivo", async ({ page }) => {
    test.skip(!USUARIO_ID, "sin usuario desechable para el detalle");
    await page.goto(`/usuarios/${USUARIO_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByRole("heading", { name: /Detalle del usuario/i })).toBeVisible();
    await expect(page.getByText(new RegExp(`Cédula ${USUARIO_CEDULA}`))).toBeVisible();
    await expect(page.getByText(/Permiso efectivo \(\d+\)/)).toBeVisible();
    await expect(page.getByText(/Rol y estado/i)).toBeVisible();
    await expect(page.getByText(/^Correo de acceso$/i)).toBeVisible();
    await expect(page.getByText(/Permisos individuales/i)).toBeVisible();

    await sinViolacionesGraves(page);
  });

  test("un override deny se refleja en el permiso efectivo y se puede retirar", async ({ page }) => {
    test.skip(!USUARIO_ID, "sin usuario desechable para los overrides");
    await page.goto(`/usuarios/${USUARIO_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByText(/Permiso efectivo \(\d+\)/)).toBeVisible({ timeout: 20_000 });
    const antes = await efectivos(page);

    await page.getByLabel("Permiso a denegar").click();
    await page.getByRole("option", { name: PERMISO_DENY }).click();
    await page.getByRole("button", { name: /^Añadir/ }).nth(1).click();
    await page.getByLabel("Motivo", { exact: true }).fill("Prueba E2E de permiso individual denegado");
    await page.getByRole("button", { name: /Guardar permisos/ }).click();
    await expect(page.locator("[data-sonner-toast]")).toContainText(/actualizados/i, {
      timeout: 20_000,
    });

    await expect(page.getByText(/Permiso efectivo \(\d+\)/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Quitar ${PERMISO_DENY} de deny` }),
    ).toBeVisible();
    await expect.poll(() => efectivos(page)).toBe(antes - 1);

    // Restauración: se retira el deny y el permiso efectivo vuelve a su tamaño original.
    await page.getByRole("button", { name: `Quitar ${PERMISO_DENY} de deny` }).click();
    await page.getByLabel("Motivo", { exact: true }).fill("Restauración de la prueba E2E");
    await page.getByRole("button", { name: /Guardar permisos/ }).click();
    await expect(page.locator("[data-sonner-toast]")).toContainText(/actualizados/i, {
      timeout: 20_000,
    });
    await expect(page.getByText(/Permiso efectivo \(\d+\)/)).toBeVisible();
    await expect.poll(() => efectivos(page)).toBe(antes);
  });

  test("la matriz muestra permisos por módulo y columnas por rol, y pide confirmación", async ({ page }) => {
    await page.goto("/usuarios/matriz");
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByRole("heading", { name: /Matriz de permisos/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: /Identidad y seguridad/i })).toBeVisible();
    await expect(page.getByRole("checkbox").first()).toBeVisible();

    await page.getByRole("button", { name: /^Guardar/ }).first().click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByLabel("Motivo")).toBeVisible();
    await expect(dialogo.getByRole("button", { name: /Confirmar cambio/ })).toBeVisible();
    await dialogo.getByRole("button", { name: "Cancelar" }).click();

    await sinViolacionesGraves(page);
  });

  test("la matriz no desborda el shell a 1182 px y la tabla hace scroll interno", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1182, height: 800 });
    await page.goto("/usuarios/matriz");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByLabel(/buscar permiso/i)).toBeVisible({ timeout: 30_000 });

    const medidas = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>("#contenido-principal");
      const tabla = document.querySelector<HTMLElement>("#contenido-principal table");
      const contenedor = tabla?.closest<HTMLElement>(".overflow-auto") ?? null;
      return {
        viewport: window.innerWidth,
        documento: document.documentElement.scrollWidth,
        main: main ? Math.round(main.getBoundingClientRect().width) : 0,
        contenedor: contenedor ? Math.round(contenedor.getBoundingClientRect().width) : 0,
        contenedorScroll: contenedor?.scrollWidth ?? 0,
        contenedorScrollX: contenedor ? getComputedStyle(contenedor).overflowX : "",
      };
    });

    expect(medidas.documento).toBeLessThanOrEqual(medidas.viewport);
    expect(medidas.main).toBeLessThanOrEqual(medidas.viewport);
    // El contenedor visible debe tener el scroll horizontal (no la tabla interna),
    // para que la barra quede al alcance sin bajar las 111 filas.
    expect(medidas.contenedorScrollX).toBe("auto");
    expect(medidas.contenedorScroll).toBeGreaterThan(medidas.contenedor);
  });

  test("un perfil sin permiso no ve el listado ni la matriz", async ({ page }) => {
    test.setTimeout(240_000);
    test.skip(
      !USUARIO_ID || !USUARIO_EMAIL || !USUARIO_PASSWORD,
      "faltan los datos del usuario desechable (E2E_D4_USUARIO_*)",
    );
    const permisosDeEntrada = ["identidad.ver_usuarios", "identidad.ver_roles"];
    // El administrador deniega temporalmente los permisos de entrada a la
    // administración en la cuenta desechable (sin tocar cuentas reales).
    await page.goto(`/usuarios/${USUARIO_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    for (const codigo of permisosDeEntrada) {
      await page.getByLabel("Permiso a denegar").click();
      await page.getByRole("option", { name: codigo }).click();
      await page.getByRole("button", { name: /^Añadir/ }).nth(1).click();
    }
    await page.getByLabel("Motivo", { exact: true }).fill("Prueba E2E de perfil sin permiso");
    await page.getByRole("button", { name: /Guardar permisos/ }).click();
    await expect(page.locator("[data-sonner-toast]")).toContainText(/actualizados/i, {
      timeout: 20_000,
    });
    for (const codigo of permisosDeEntrada) {
      await expect(page.getByRole("button", { name: `Quitar ${codigo} de deny` })).toBeVisible({
        timeout: 20_000,
      });
    }

    try {
      await page.context().clearCookies();
      await iniciarSesionComo(page, USUARIO_EMAIL as string, USUARIO_PASSWORD as string);

      await page.goto("/usuarios");
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page.getByRole("table")).toHaveCount(0);
      await expect(page.getByText(/No tiene el permiso/i)).toBeVisible({ timeout: 20_000 });

      await page.goto("/usuarios/matriz");
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page.getByText(/No tiene el permiso/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("checkbox")).toHaveCount(0);
    } finally {
      // Restaura la cuenta desechable con el administrador.
      await page.context().clearCookies();
      await iniciarSesionComo(page, EMAIL, PASSWORD);
      await page.goto(`/usuarios/${USUARIO_ID}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      for (const codigo of permisosDeEntrada) {
        const boton = page.getByRole("button", { name: `Quitar ${codigo} de deny` });
        if (await boton.count()) await boton.click();
      }
      await page.getByLabel("Motivo", { exact: true }).fill("Restauración de la prueba E2E");
      await page.getByRole("button", { name: /Guardar permisos/ }).click();
      await expect(page.locator("[data-sonner-toast]")).toContainText(/actualizados/i, {
        timeout: 20_000,
      });
    }
  });
});
