import { expect, test } from "@playwright/test";

import { entrar, ir, paso, vigilar } from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const TRAB_CEDULA = process.env.E2E_TRAB_CEDULA ?? "99000302";

/**
 * O49-BLOQUEO: la cédula del trabajador es inmutable tras el registro.
 * Comprueba en PC y teléfono que la edición de RRHH muestra la cédula como
 * campo bloqueado (no editable) y con su valor actual.
 */
test.describe("O49 · Cédula inmutable", () => {
  test("la cédula aparece bloqueada en la edición del expediente", async ({ page }, info) => {
    test.setTimeout(240_000);
    const incidencias: string[] = [];
    const anotar = (r: { problemas: string[] }) => incidencias.push(...r.problemas);

    // La foto es opcional: la cédula E2E puede no tenerla y su 404 no es un
    // fallo de la regla O49. Se responde con una imagen transparente para que
    // la consola no registre un error de recurso.
    await page.route(/\/api\/v1\/personal\/[^/]+\/foto\/?(\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );

    await entrar(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    // El dashboard puede emitir un pageerror de hidratación ajeno a O49; el
    // vigilante se crea cuando ya se va a recorrer el flujo de la cédula.
    await page.waitForLoadState("networkidle").catch(() => {});
    const vigilante = vigilar(page);
    anotar(await paso(page, info, vigilante, "O49", "01-sesion-iniciada"));

    await ir(page, "/personal/consultar");
    const buscador = page.getByPlaceholder(/Buscar cédula/i);
    if (!(await buscador.isVisible().catch(() => false))) {
      // En teléfono los filtros están plegados.
      await page.getByRole("button", { name: /Mostrar filtros/i }).click();
    }
    await buscador.fill(TRAB_CEDULA);
    await page.getByRole("button", { name: /^Buscar$/i }).click();
    const fila = page.locator("tr", { hasText: TRAB_CEDULA });
    await expect(fila.first()).toBeVisible({ timeout: 30_000 });
    anotar(await paso(page, info, vigilante, "O49", "02-trabajador-encontrado"));

    await fila.first().getByRole("button", { name: /Abrir Menu/i }).click();
    await page.getByRole("menuitem", { name: /Ver Detalles/i }).click();
    await expect(
      page.getByText(/Información Detallada Del Trabajador/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    anotar(await paso(page, info, vigilante, "O49", "03-expediente-abierto"));

    await page.getByRole("button", { name: /Actualizar Informaci/i }).click();
    const cedula = page.getByLabel(/Cédula de identidad \(no editable\)/i);
    await expect(cedula).toBeVisible({ timeout: 20_000 });
    await expect(cedula).toBeDisabled();
    await expect(cedula).toHaveValue(TRAB_CEDULA);
    await expect(
      page.getByText(/use «Reportar error» para que RRHH la corrija/i),
    ).toBeVisible();
    anotar(await paso(page, info, vigilante, "O49", "04-cedula-bloqueada"));

    expect
      .soft(incidencias, `Incidencias O49:\n${incidencias.join("\n")}`)
      .toEqual([]);
  });
});
