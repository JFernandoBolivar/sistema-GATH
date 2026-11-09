import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { POST } from "./route";

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { post: vi.fn(), getBlobConRespuesta: vi.fn() },
}));

function peticion(query: string) {
  return new NextRequest(
    `http://localhost:3001/api/fe-de-vida/estadisticas/exportar${query}`,
    {
      method: "POST",
      body: JSON.stringify({ imagenes: ["data:image/png;base64,AAAA"] }),
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("POST /api/fe-de-vida/estadisticas/exportar", () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.post).mockResolvedValue({ status: "success", data: { id: "x" } });
  });

  it("pasa el formato y los filtros como params al backend (FIX-QA13)", async () => {
    const respuesta = await POST(
      peticion("?formato=pdf&estado=VALIDADA&incluir_resumen=true&incluir_graficos=true&vacio="),
    );

    expect(respuesta.status).toBe(202);
    const [, cuerpo, opciones] = vi.mocked(apiClient.post).mock.calls[0];
    expect(cuerpo).toEqual({ imagenes: ["data:image/png;base64,AAAA"] });
    expect(opciones).toEqual({
      params: {
        formato: "pdf",
        estado: "VALIDADA",
        incluir_resumen: "true",
        incluir_graficos: "true",
      },
    });
  });
});
