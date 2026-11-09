import { expect, test } from "@playwright/test";

import {
  ahoraLocal,
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

interface Credencial {
  id: string;
  nombre: string;
  documento: string;
  estado: string;
  security_hash: string;
  vigencia_desde: string;
  vigencia_hasta: string;
}

function campo(page: Parameters<typeof paso>[0], etiqueta: string) {
  return page.locator(`xpath=//label[normalize-space(.)='${etiqueta}']/following::input[1]`);
}

async function listar(page: Parameters<typeof paso>[0]): Promise<Credencial[]> {
  return apiJson<Credencial[]>(page, "carnetizacion/credenciales-externas/");
}

function porNombre(filas: Credencial[], nombre: string): Credencial | undefined {
  return filas.find((f) => f.nombre === nombre);
}

/**
 * Flujo B: visitante/contratista.
 * Registrar, emitir, descargar PDF, devolver una credencial y anular otra;
 * comprobar que el QR anulado deja de ser válido.
 */
test.describe("B · Visitante y contratista", () => {
  test("registra, emite, devuelve y anula", async ({ page }, info) => {
    test.setTimeout(240_000);
    const vigilante = vigilar(page);
    const incidencias: string[] = [];
    const anotar = (r: { problemas: string[] }) => incidencias.push(...r.problemas);
    const sufijo = Date.now().toString().slice(-6);
    const nombreDevuelto = `E2E-Visitante Devuelto ${sufijo}`;
    const nombreAnulado = `E2E-Contratista Anulado ${sufijo}`;
    const documentoDevuelto = `E2E-V-${sufijo}`;
    const documentoAnulado = `E2E-C-${sufijo}`;

    await entrar(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    anotar(await paso(page, info, vigilante, "B", "01-sesion-iniciada"));

    await ir(page, "/carnetizacion/visitantes");
    await expect(page.getByText(/Nueva credencial de visita/i)).toBeVisible({ timeout: 20_000 });
    anotar(await paso(page, info, vigilante, "B", "02-formulario-visita"));

    async function emitir(nombre: string, documento: string, motivo: string) {
      await campo(page, "Nombre completo").fill(nombre);
      await campo(page, "Documento").fill(documento);
      await campo(page, "Empresa").fill("E2E-Empresa");
      await campo(page, "Contrato / referencia").fill("E2E-Contrato");
      await campo(page, "Persona visitada").fill("E2E-Persona");
      const ahora = new Date();
      const fin = new Date(ahora.getTime() + 2 * 60 * 60 * 1000);
      await campo(page, "Desde").fill(ahoraLocal(ahora));
      await campo(page, "Hasta").fill(ahoraLocal(fin));
      await campo(page, "Motivo").fill(motivo);
      await page.getByRole("button", { name: /Emitir/i }).first().click();
      await expect(page.getByText(/Credencial emitida/i)).toBeVisible({ timeout: 20_000 });
      // La lista puede tardar un instante en reflejar el registro recién creado.
      let credencial: Credencial | undefined;
      for (let intento = 0; intento < 20 && !credencial; intento++) {
        credencial = porNombre(await listar(page), nombre);
        if (!credencial) await page.waitForTimeout(500);
      }
      expect(credencial, "La credencial debe quedar registrada").toBeTruthy();
      return credencial as Credencial;
    }

    const devuelta = await emitir(nombreDevuelto, documentoDevuelto, "E2E-Motivo devolución");
    anotar(await paso(page, info, vigilante, "B", "03-credencial-emitida"));

    const filaDevuelta = page.locator("tr", { hasText: nombreDevuelto });
    const pdfBuffer = await descargarOApi(
      page,
      filaDevuelta.locator('button[title="PDF"]'),
      `carnetizacion/credenciales-externas/${devuelta.id}/pdf/`,
      `${info.project.name}-B-credencial-${sufijo}.pdf`,
    );
    const pdf = validarPdf(pdfBuffer);
    expect.soft(pdf.cabecera, "La credencial descargada debe ser PDF").toBe("%PDF-");
    anotar(await paso(page, info, vigilante, "B", "04-pdf-credencial"));

    await filaDevuelta.locator('button[title="Devolver"]').click();
    await expect(page.getByText(/Devolución registrada/i)).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => porNombre(await listar(page), nombreDevuelto)?.estado, {
        timeout: 20_000,
      })
      .toBe("DEVUELTA");
    anotar(await paso(page, info, vigilante, "B", "05-credencial-devuelta"));

    const anulada = await emitir(nombreAnulado, documentoAnulado, "E2E-Motivo anulación");
    const filaAnulada = page.locator("tr", { hasText: nombreAnulado });
    await filaAnulada.locator('button[title="Anular"]').click();
    await expect(page.getByText(/Credencial anulada/i)).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => porNombre(await listar(page), nombreAnulado)?.estado, {
        timeout: 20_000,
      })
      .toBe("ANULADA");
    anotar(await paso(page, info, vigilante, "B", "06-credencial-anulada"));

    await ir(page, `/carnet/${anulada.security_hash}`);
    const textoQr = await page.locator("body").innerText();
    const invalido = /no válid|no se encontró|error de verificaci/i.test(textoQr);
    expect.soft(invalido, "El QR anulado no debe mostrar una ficha vigente").toBeTruthy();
    if (!invalido) incidencias.push("El QR anulado sigue mostrando una ficha válida");
    anotar(await paso(page, info, vigilante, "B", "07-qr-anulado"));

    expect
      .soft(incidencias, `Incidencias del flujo B:\n${incidencias.join("\n")}`)
      .toEqual([]);
  });
});
