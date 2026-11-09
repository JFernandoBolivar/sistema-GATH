import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  DIR_O46,
  api,
  apiJson,
  entrar,
  ir,
  paso,
  validarPdf,
  vigilar,
} from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

interface Credencial {
  id: string;
  nombre: string;
  estado: string;
  security_hash: string;
}

/** Crea por API las credenciales que falten para poder probar la hoja por lote. */
async function asegurarActivas(
  page: Parameters<typeof paso>[0],
  cantidad: number,
): Promise<Credencial[]> {
  let activas = (await apiJson<Credencial[]>(page, "carnetizacion/credenciales-externas/")).filter(
    (c) => c.estado === "ACTIVA",
  );
  let intento = 0;
  while (activas.length < cantidad && intento < cantidad) {
    intento += 1;
    const ahora = new Date();
    const fin = new Date(ahora.getTime() + 4 * 60 * 60 * 1000);
    await api(page, "carnetizacion/credenciales-externas/", {
      method: "POST",
      data: {
        tipo_codigo: "visitante",
        nombre: `E2E-Lote ${Date.now()}-${intento}`,
        documento: `E2E-L-${Date.now()}-${intento}`,
        motivo: "E2E-Lote de impresión",
        vigencia_desde: ahora.toISOString(),
        vigencia_hasta: fin.toISOString(),
      },
    });
    activas = (await apiJson<Credencial[]>(page, "carnetizacion/credenciales-externas/")).filter(
      (c) => c.estado === "ACTIVA",
    );
  }
  return activas;
}

/**
 * Flujo D: impresión por lote.
 * Seleccionar varias credenciales activas y generar el PDF A4 con marcas de corte.
 */
test.describe("D · Impresión por lote", () => {
  test("selecciona varias y genera el PDF del lote", async ({ page }, info) => {
    test.setTimeout(240_000);
    const vigilante = vigilar(page);
    const incidencias: string[] = [];
    const anotar = (r: { problemas: string[] }) => incidencias.push(...r.problemas);

    await entrar(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    anotar(await paso(page, info, vigilante, "D", "01-sesion-iniciada"));

    const activas = await asegurarActivas(page, 2);
    expect(activas.length, "Debe haber al menos 2 credenciales activas").toBeGreaterThanOrEqual(
      2,
    );

    await ir(page, "/carnetizacion/lote");
    await expect(page.getByText(/Impresión por lote/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Generar lote/i)).toBeVisible({ timeout: 20_000 });
    anotar(await paso(page, info, vigilante, "D", "02-listado-lote"));

    const filasActivas = page.locator("tr", { hasText: "ACTIVA" });
    const total = await filasActivas.count();
    const aSeleccionar = Math.min(2, total);
    for (let i = 0; i < aSeleccionar; i++) {
      await filasActivas.nth(i).locator('[role="checkbox"]').click();
    }
    await expect(page.getByRole("button", { name: /Generar lote \(/i })).toBeEnabled({
      timeout: 10_000,
    });
    anotar(await paso(page, info, vigilante, "D", "03-credenciales-seleccionadas"));

    const ids = activas.slice(0, aSeleccionar).map((c) => c.id);
    const espera = page.waitForEvent("download", { timeout: 20_000 }).catch(() => null);
    await page.getByRole("button", { name: /Generar lote \(/i }).click();
    const descarga = await espera;

    let buffer: Buffer | null = null;
    const archivo = `${info.project.name}-D-lote.pdf`;
    if (descarga) {
      await descarga.saveAs(path.join(DIR_O46, archivo));
      buffer = fs.readFileSync(path.join(DIR_O46, archivo));
    } else {
      const respuesta = await api(page, "carnetizacion/credenciales-externas/lote/pdf/", {
        method: "POST",
        data: { ids },
      });
      if (respuesta.ok()) {
        buffer = await respuesta.body();
        fs.writeFileSync(path.join(DIR_O46, archivo), buffer);
      } else {
        incidencias.push(`PDF del lote no recuperable: POST lote/pdf -> ${respuesta.status()}`);
      }
    }

    if (buffer) {
      const pdf = validarPdf(buffer);
      expect.soft(pdf.cabecera, "El lote descargado debe ser PDF").toBe("%PDF-");
      expect.soft(pdf.paginas, "El lote debe tener al menos una página").toBeGreaterThanOrEqual(1);
    } else {
      incidencias.push("No se obtuvo el PDF del lote para validar marcas de corte");
    }
    anotar(await paso(page, info, vigilante, "D", "04-pdf-lote"));

    expect
      .soft(incidencias, `Incidencias del flujo D:\n${incidencias.join("\n")}`)
      .toEqual([]);
  });
});
