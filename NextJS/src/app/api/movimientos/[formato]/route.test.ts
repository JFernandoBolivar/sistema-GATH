import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { ApiHttpError, SessionExpiredError } from "@/shared/infrastructure/http/errors";
import { GET } from "./route";

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { getBlobConRespuesta: vi.fn() },
}));

const getBlob = vi.mocked(apiClient.getBlobConRespuesta);

function pedir(formato: string, query = "") {
  const req = new NextRequest(`http://localhost:3001/api/movimientos/${formato}${query}`);
  return GET(req, { params: Promise.resolve({ formato }) });
}

function respuestaOk(headers: Record<string, string> = {}) {
  return {
    blob: new Blob(["documento"]),
    headers: new Headers(headers),
    status: 200,
  };
}

describe("GET /api/movimientos/{formato}", () => {
  beforeEach(() => {
    getBlob.mockReset();
  });

  it("reenvía solo los filtros conocidos al PDF y propaga las cabeceras de truncado", async () => {
    getBlob.mockResolvedValue(
      respuestaOk({
        "x-reporte-total-registros": "6123",
        "x-reporte-limite": "5000",
        "x-reporte-truncado": "true",
      }),
    );

    const respuesta = await pedir(
      "pdf",
      "?cedula=V123&fecha_inicio=2026-01-01&campo_inventado=1&pagina=3",
    );

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toBe("application/pdf");
    expect(respuesta.headers.get("x-reporte-truncado")).toBe("true");
    expect(respuesta.headers.get("x-reporte-limite")).toBe("5000");
    expect(respuesta.headers.get("x-reporte-total-registros")).toBe("6123");

    const [ruta, opciones] = getBlob.mock.calls[0];
    expect(ruta).toBe("/api/v1/movimientos/pdf/");
    expect(opciones?.params).toEqual({
      cedula: "V123",
      fecha_inicio: "2026-01-01",
    });
  });

  it("el Excel responde con su tipo de contenido", async () => {
    getBlob.mockResolvedValue(respuestaOk({ "x-reporte-truncado": "false" }));

    const respuesta = await pedir("excel");

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toContain("spreadsheetml");
    expect(respuesta.headers.get("content-disposition")).toContain("historial-movimientos.xlsx");
  });

  it("rechaza un formato desconocido sin llamar al backend", async () => {
    const respuesta = await pedir("csv");

    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error).toContain("csv");
    expect(getBlob).not.toHaveBeenCalled();
  });

  it("conserva el estado y el mensaje del backend (403 por permiso)", async () => {
    vi.mocked(apiClient.getBlobConRespuesta).mockRejectedValue(
      new ApiHttpError("No tiene el permiso requerido.", 403),
    );

    const respuesta = await pedir("pdf");

    expect(respuesta.status).toBe(403);
    expect((await respuesta.json()).error).toContain("permiso");
  });

  it("responde 401 cuando la sesión expiró", async () => {
    getBlob.mockRejectedValue(new SessionExpiredError());

    const respuesta = await pedir("excel");

    expect(respuesta.status).toBe(401);
    expect((await respuesta.json()).error).toContain("sesión");
  });
});
