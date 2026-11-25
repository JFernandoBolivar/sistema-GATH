import { beforeEach, describe, expect, it, vi } from "vitest";

import { documentosApi } from "./documentos-api";

const { get, post } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { get, post },
}));

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("documentosApi: procesos y baja demanda", () => {
  it("consulta el catálogo completo o el de un proceso exacto", async () => {
    await documentosApi.variables();
    await documentosApi.variables("ingreso_contratacion");
    expect(get).toHaveBeenNthCalledWith(1, "/api/v1/documentos/variables/", { params: { proceso: undefined } });
    expect(get).toHaveBeenNthCalledWith(2, "/api/v1/documentos/variables/", { params: { proceso: "ingreso_contratacion" } });
  });

  it("pide plantillas por grupo y proceso junto con las alertas", async () => {
    await documentosApi.listarConAlertas({ grupo: "punto_cuenta", proceso: "punto_cuenta:cambio_nivel" });
    expect(get).toHaveBeenCalledWith("/api/v1/documentos/plantillas/", {
      params: { grupo: "punto_cuenta", proceso: "punto_cuenta:cambio_nivel", incluir_alertas: true },
    });
  });

  it("carga y genera documentos bajo demanda mediante el cliente de servidor", async () => {
    await documentosApi.bajoDemanda("V12345678");
    expect(get).toHaveBeenCalledWith("/api/v1/documentos/bajo-demanda/", {
      params: { trabajador_cedula: "V12345678" },
    });

    const entrada = { plantilla_id: "pl1", trabajador_cedula: "V12345678", valores_propios: { destino: "Banco" } };
    await documentosApi.generarBajoDemanda(entrada);
    expect(post).toHaveBeenCalledWith("/api/v1/documentos/bajo-demanda/generar/", entrada);


  });
});
