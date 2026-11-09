import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  archivoDeRespuesta,
  esCancelacion,
  esperarYDescargarExportacion,
  textoDeProgreso,
} from "./exportaciones-asincronas";

const fetchMock = vi.fn();

function estado(estadoTrabajo: string, progreso = 0, error = "") {
  return new Response(
    JSON.stringify({ status: "success", data: { id: "abc", estado: estadoTrabajo, progreso, error } }),
    { status: 200 },
  );
}

const sinEspera = vi.fn<(ms: number) => Promise<void>>(async () => undefined);

describe("exportaciones asíncronas (cliente)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    sinEspera.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("consulta el estado con espera creciente y descarga al terminar", async () => {
    fetchMock
      .mockResolvedValueOnce(estado("PENDIENTE"))
      .mockResolvedValueOnce(estado("EN_PROCESO", 40))
      .mockResolvedValueOnce(estado("LISTO", 100))
      .mockResolvedValueOnce(
        new Response("archivo", {
          status: 200,
          headers: { "x-reporte-truncado": "true", "x-reporte-limite": "5000", "x-reporte-total-registros": "9000" },
        }),
      );
    const progresos: number[] = [];

    const resultado = await esperarYDescargarExportacion("abc", {
      esperar: sinEspera,
      onProgreso: (p) => progresos.push(p.progreso),
    });

    expect(progresos).toEqual([0, 40, 100]);
    expect(sinEspera.mock.calls.map((c) => c[0])).toEqual([1000, 1500]);
    expect(fetchMock.mock.calls[3][0]).toBe("/api/exportaciones/abc/descargar");
    expect(await resultado.blob.text()).toBe("archivo");
    expect(resultado).toMatchObject({ truncado: true, limite: 5000, total: 9000 });
  });

  it("el retraso se estabiliza en el último valor", async () => {
    for (let i = 0; i < 7; i++) fetchMock.mockResolvedValueOnce(estado("EN_PROCESO", i));
    fetchMock.mockResolvedValueOnce(estado("LISTO", 100)).mockResolvedValueOnce(new Response("x"));

    await esperarYDescargarExportacion("abc", { esperar: sinEspera });

    expect(sinEspera.mock.calls.map((c) => c[0])).toEqual([1000, 1500, 2000, 3000, 5000, 5000, 5000]);
  });

  it("un trabajo en ERROR muestra el mensaje y no descarga", async () => {
    fetchMock.mockResolvedValueOnce(estado("ERROR", 10, "Filtro inválido."));

    await expect(esperarYDescargarExportacion("abc", { esperar: sinEspera })).rejects.toThrow(
      "Filtro inválido.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un archivo expirado se informa", async () => {
    fetchMock.mockResolvedValueOnce(estado("EXPIRADO"));
    await expect(esperarYDescargarExportacion("abc", { esperar: sinEspera })).rejects.toThrow("expiró");
  });

  it("se rinde cuando supera el tiempo máximo", async () => {
    fetchMock.mockImplementation(async () => estado("EN_PROCESO", 5));
    await expect(
      esperarYDescargarExportacion("abc", { esperar: sinEspera, maximoMs: 3000 }),
    ).rejects.toThrow("tardando demasiado");
  });

  it("se detiene al cancelar (salir de la página) sin seguir consultando", async () => {
    const control = new AbortController();
    fetchMock.mockResolvedValue(estado("EN_PROCESO", 5));
    const esperar = vi.fn(async () => {
      control.abort();
    });

    const promesa = esperarYDescargarExportacion("abc", { esperar, signal: control.signal });

    await expect(promesa).rejects.toSatisfy(esCancelacion);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("un 404 del estado propaga el mensaje del handler", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "La exportación solicitada no existe." }), { status: 404 }),
    );
    await expect(esperarYDescargarExportacion("abc", { esperar: sinEspera })).rejects.toThrow("no existe");
  });

  describe("archivoDeRespuesta", () => {
    it("una respuesta 200 ya trae el archivo (reportes síncronos)", async () => {
      const resultado = await archivoDeRespuesta(new Response("pdf", { status: 200 }), "falló");
      expect(await resultado.blob.text()).toBe("pdf");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("una respuesta 202 espera el trabajo y descarga", async () => {
      fetchMock.mockResolvedValueOnce(estado("LISTO", 100)).mockResolvedValueOnce(new Response("xlsx"));
      const accepted = new Response(
        JSON.stringify({ status: "success", data: { id: "abc", estado: "PENDIENTE", progreso: 0 } }),
        { status: 202 },
      );

      const resultado = await archivoDeRespuesta(accepted, "falló", { esperar: sinEspera });

      expect(await resultado.blob.text()).toBe("xlsx");
    });

    it("un error del backend conserva su mensaje", async () => {
      const respuesta = new Response(JSON.stringify({ error: "Sin permiso." }), { status: 403 });
      await expect(archivoDeRespuesta(respuesta, "falló")).rejects.toThrow("Sin permiso.");
    });
  });

  it("texto de progreso", () => {
    expect(textoDeProgreso(null)).toBe("Generando reporte…");
    expect(textoDeProgreso({ estado: "PENDIENTE", progreso: 0 })).toBe("Generando reporte…");
    expect(textoDeProgreso({ estado: "EN_PROCESO", progreso: 40.4 })).toBe("Generando reporte… 40%");
  });
});
