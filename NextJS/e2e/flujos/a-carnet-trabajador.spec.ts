import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  DIR_O46,
  api,
  apiJson,
  carnetDe,
  entrar,
  guardarDescarga,
  ir,
  paso,
  validarPdf,
  vigilar,
  type DatosCarnet,
} from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const TRAB_CEDULA = process.env.E2E_TRAB_CEDULA ?? "99000302";

/**
 * Flujo A: carnet de trabajador.
 * Buscar por cédula, emitir con la plantilla activa, descargar y validar el PDF
 * (firma %PDF y 2 páginas) y abrir la ficha pública /carnet/[hash].
 */
test.describe("A · Carnet de trabajador", () => {
  test("emite, descarga y verifica el carnet", async ({ page }, info) => {
    test.setTimeout(240_000);
    const vigilante = vigilar(page);
    const incidencias: string[] = [];
    const anotar = (r: { problemas: string[] }) => incidencias.push(...r.problemas);

    await entrar(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    anotar(await paso(page, info, vigilante, "A", "01-sesion-iniciada"));

    await ir(page, "/carnetizacion/buscar");
    await page.getByPlaceholder(/cédula o nombre/i).fill(TRAB_CEDULA);
    await page.getByRole("button", { name: /^buscar$/i }).click();
    await expect(page.getByText(/Generar Carnet/i).first()).toBeVisible({ timeout: 20_000 });
    anotar(await paso(page, info, vigilante, "A", "02-trabajador-encontrado"));

    await page.getByRole("button", { name: /Generar Carnet/i }).first().click();
    await page.waitForURL(/\/carnetizacion\/generar\?cedula=/, { timeout: 20_000 });
    await expect(page.getByText(/Emitir y descargar PDF/i)).toBeVisible({ timeout: 20_000 });
    anotar(await paso(page, info, vigilante, "A", "03-formulario-emision"));

    const descargaPdf = page.waitForEvent("download", { timeout: 20_000 }).catch(() => null);
    await page.getByRole("button", { name: /Emitir y descargar PDF/i }).click();
    await page.waitForTimeout(2_500);
    anotar(await paso(page, info, vigilante, "A", "04-pdf-descargado"));

    let buffer: Buffer | null = null;
    const descarga = await descargaPdf;
    if (descarga) {
      buffer = await guardarDescarga(
        descarga,
        `${info.project.name}-A-carnet-${TRAB_CEDULA}.pdf`,
      );
    }

    const carnet = await esperarCarnet(page, TRAB_CEDULA);
    if (!buffer && carnet) {
      // La vista emite el carnet pero el navegador no siempre entrega el blob como
      // descarga: se recupera el PDF por el endpoint autenticado para validarlo.
      const respuesta = await api(page, `carnetizacion/${carnet.id}/pdf/`);
      if (respuesta.ok()) {
        buffer = await respuesta.body();
        fs.writeFileSync(
          path.join(DIR_O46, `${info.project.name}-A-carnet-${TRAB_CEDULA}.pdf`),
          buffer,
        );
      } else {
        incidencias.push(
          `PDF del carnet no recuperable: GET /api/v1/carnetizacion/${carnet.id}/pdf/ -> ${respuesta.status()}`,
        );
      }
    }

    if (buffer) {
      const pdf = validarPdf(buffer);
      expect.soft(pdf.cabecera, "El archivo descargado debe ser un PDF").toBe("%PDF-");
      expect.soft(pdf.paginas, "El carnet debe tener 2 páginas").toBe(2);
    } else {
      incidencias.push("No se obtuvo el PDF del carnet para validar firma y páginas");
    }

    expect(carnet?.security_hash, "El carnet emitido debe tener hash público").toBeTruthy();

    await ir(page, `/carnet/${carnet?.security_hash}`);
    await expect(page.getByText(/Carnet vigente|Ficha Verificada/i).first()).toBeVisible({
      timeout: 30_000,
    });
    anotar(await paso(page, info, vigilante, "A", "05-ficha-publica"));

    expect
      .soft(incidencias, `Incidencias del flujo A:\n${incidencias.join("\n")}`)
      .toEqual([]);
  });
});

async function esperarCarnet(
  page: Parameters<typeof carnetDe>[0],
  cedula: string,
): Promise<DatosCarnet | undefined> {
  for (let intento = 0; intento < 10; intento++) {
    const carnet = await carnetDe(page, cedula);
    if (carnet?.security_hash) return carnet;
    await page.waitForTimeout(1000);
  }
  return apiJson<DatosCarnet[]>(page, `carnetizacion/?cedula=${cedula}`).then((c) => c[0]);
}
