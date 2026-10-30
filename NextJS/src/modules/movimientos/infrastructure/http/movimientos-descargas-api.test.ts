import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { descargarHistorial } from "./movimientos-descargas-api";

const fetchMock = vi.fn();

function respuesta(headers: Record<string, string>, cuerpo = "archivo") {
  return new Response(cuerpo, { status: 200, headers });
}

describe("descarga del historial de movimientos", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("pide el PDF con los filtros y lee las cabeceras de truncado", async () => {
    fetchMock.mockResolvedValue(
      respuesta({
        "x-reporte-truncado": "true",
        "x-reporte-limite": "5000",
        "x-reporte-total-registros": "6123",
      }),
    );

    const resultado = await descargarHistorial("pdf", {
      cedula: "V123",
      fecha_inicio: "2026-01-01",
      gerencia: "",
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/api/movimientos/pdf?");
    expect(url).toContain("cedula=V123");
    expect(url).toContain("fecha_inicio=2026-01-01");
    expect(url).not.toContain("gerencia=");
    expect(resultado.truncado).toBe(true);
    expect(resultado.limite).toBe(5000);
    expect(resultado.total).toBe(6123);
    expect(await resultado.blob.text()).toBe("archivo");
  });

  it("usa la ruta de Excel y, sin cabeceras, no marca truncado", async () => {
    fetchMock.mockResolvedValue(respuesta({}));

    const resultado = await descargarHistorial("excel");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/movimientos/excel");
    expect(resultado).toEqual({ blob: expect.any(Blob), total: null, limite: null, truncado: false });
  });

  it("propaga el mensaje de error del backend", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "La fecha de inicio no puede ser posterior." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(descargarHistorial("pdf")).rejects.toThrow("fecha de inicio");
  });
});
