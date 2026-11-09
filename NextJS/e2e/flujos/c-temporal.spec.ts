import { expect, test } from "@playwright/test";

import {
  apiJson,
  descargarOApi,
  entrar,
  ir,
  paso,
  validarPdf,
  vigilar,
} from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const TRAB_CEDULA = process.env.E2E_TRAB_CEDULA ?? "99000302";

interface Credencial {
  id: string;
  nombre: string;
  documento: string;
  motivo: string;
  estado: string;
  security_hash: string;
  vigencia_desde: string;
  vigencia_hasta: string;
}

function campo(page: Parameters<typeof paso>[0], etiqueta: string) {
  return page.locator(`xpath=//label[normalize-space(.)='${etiqueta}']/following::input[1]`);
}

/**
 * Flujo C: credencial temporal de trabajador.
 * Emitir por olvido/extravío con vigencia corta y verificar la fecha de vencimiento.
 */
test.describe("C · Credencial temporal", () => {
  test("emite y verifica el vencimiento", async ({ page }, info) => {
    test.setTimeout(240_000);
    const vigilante = vigilar(page);
    const incidencias: string[] = [];
    const anotar = (r: { problemas: string[] }) => incidencias.push(...r.problemas);
    const sufijo = Date.now().toString().slice(-6);
    const motivo = `E2E-Temporal ${sufijo}`;

    await entrar(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    anotar(await paso(page, info, vigilante, "C", "01-sesion-iniciada"));

    await ir(page, "/carnetizacion/temporal");
    await expect(page.getByText(/Nueva credencial temporal/i)).toBeVisible({ timeout: 20_000 });
    anotar(await paso(page, info, vigilante, "C", "02-formulario-temporal"));

    const buscador = page.getByPlaceholder(/buscar cédula/i);
    await buscador.fill(TRAB_CEDULA);
    await buscador.locator("xpath=following::button[1]").click();
    await expect
      .poll(async () => campo(page, "Trabajador").inputValue(), { timeout: 25_000 })
      .not.toBe("");
    await campo(page, "Vigencia (horas)").fill("1");
    await campo(page, "Motivo").fill(motivo);
    await page.getByRole("button", { name: /Emitir/i }).first().click();
    await expect(page.getByText(/Credencial temporal emitida/i)).toBeVisible({ timeout: 20_000 });
    anotar(await paso(page, info, vigilante, "C", "03-temporal-emitida"));

    const filas = await apiJson<Credencial[]>(page, "carnetizacion/credenciales-temporales/");
    const temporal = filas.find((f) => f.motivo === motivo || f.documento === TRAB_CEDULA);
    expect.soft(temporal, "La credencial temporal debe quedar registrada").toBeTruthy();
    if (!temporal) {
      incidencias.push("No se encontró la credencial temporal en la API");
    } else {
      const hasta = new Date(temporal.vigencia_hasta).getTime();
      const ahora = Date.now();
      const horas = (hasta - ahora) / 3_600_000;
      expect.soft(temporal.estado, "La credencial temporal debe estar ACTIVA").toBe("ACTIVA");
      expect
        .soft(horas, `Vigencia de ${horas.toFixed(2)} h debe ser cercana a 1 h`)
        .toBeGreaterThan(0);
      expect.soft(horas, "La vigencia no debe superar 2 h").toBeLessThan(2);
      const fila = page.locator("tr", { hasText: motivo });
      await expect(fila).toContainText("ACTIVA", { timeout: 20_000 });
    }
    anotar(await paso(page, info, vigilante, "C", "04-vencimiento-verificado"));

    if (temporal) {
      const fila = page.locator("tr", { hasText: motivo });
      const buffer = await descargarOApi(
        page,
        fila.locator('button[title="PDF"]'),
        `carnetizacion/credenciales-externas/${temporal.id}/pdf/`,
        `${info.project.name}-C-temporal-${sufijo}.pdf`,
      );
      const pdf = validarPdf(buffer);
      expect.soft(pdf.cabecera, "La credencial temporal descargada debe ser PDF").toBe("%PDF-");
      anotar(await paso(page, info, vigilante, "C", "05-pdf-temporal"));

      await ir(page, `/carnet/${temporal.security_hash}`);
      anotar(await paso(page, info, vigilante, "C", "06-qr-temporal"));
    }

    expect
      .soft(incidencias, `Incidencias del flujo C:\n${incidencias.join("\n")}`)
      .toEqual([]);
  });
});
