import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FIX-QA16: el filtro «Sin cuenta» llegaba al repositorio pero `getPasivos`
 * armaba los params a mano y lo descartaba, así que el backend recibía la
 * lista completa.
 */
const get = vi.hoisted(() => vi.fn());

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { get },
}));

import { repoPasivosApi } from "../repositories/repo-pasivos-api";
import { pasivosApi } from "./pasivos-api";

function paginaVacia() {
  return {
    status: "success",
    message: "ok",
    data: {
      results: [],
      total: 0,
      pagina: 1,
      tamano: 50,
      total_paginas: 0,
    },
  };
}

describe("pasivosApi.getPasivos (FIX-QA16)", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue(paginaVacia());
  });

  it("envía sin_cuenta al backend", async () => {
    await pasivosApi.getPasivos({ sin_cuenta: true, limit: 25, offset: 0 });

    expect(get).toHaveBeenCalledWith(
      "/api/v1/pasivos/",
      {
        params: expect.objectContaining({
          sin_cuenta: true,
          limit: 25,
          offset: 0,
        }),
      },
    );
  });

  it("el repositorio reenvía el filtro de dominio sinCuenta", async () => {
    await repoPasivosApi.listarPasivosPaginados({ sinCuenta: true, limit: 10, offset: 0 });

    const [, opciones] = get.mock.calls[0];
    expect(opciones.params.sin_cuenta).toBe(true);
  });

  it("mantiene el filtro cuando es false y lo deja ausente si no se indica", async () => {
    await pasivosApi.getPasivos({ sin_cuenta: false });
    expect(get.mock.calls[0][1].params.sin_cuenta).toBe(false);

    get.mockClear();
    await pasivosApi.getPasivos({ cedula: "12345678" });
    expect(get.mock.calls[0][1].params.sin_cuenta).toBeUndefined();
  });
});
