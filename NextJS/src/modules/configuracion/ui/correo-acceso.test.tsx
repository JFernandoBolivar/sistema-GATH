import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, put, post } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { get, put, post },
}));

import { correoAccesoApi } from "../infrastructure/http/correo-acceso-api";

beforeEach(() => {
  get.mockReset();
  put.mockReset();
  post.mockReset();
});

describe("Módulo Configuración - Correo de Acceso (A7)", () => {
  it("API client obtiene la política de correo de acceso", async () => {
    get.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        politica_pasivos: "alternativo",
        politica_activos: "institucional",
        si_falta_elegido: "dejar_sin_cuenta",
        avisar_al_aplicar_masivo: false,
      },
    });

    const resultado = await correoAccesoApi.obtenerPolitica();
    expect(get).toHaveBeenCalledWith("/api/v1/configuracion/correo-acceso/politica/");
    expect(resultado.data.politica_pasivos).toBe("alternativo");
    expect(resultado.data.politica_activos).toBe("institucional");
  });

  it("API client actualiza la política de correo de acceso", async () => {
    const payload = {
      politica_pasivos: "alternativo" as const,
      politica_activos: "institucional" as const,
      si_falta_elegido: "usar_siguiente" as const,
      avisar_al_aplicar_masivo: true,
    };
    put.mockResolvedValue({
      status: "success",
      message: "ok",
      data: payload,
    });

    const res = await correoAccesoApi.actualizarPolitica(payload);
    expect(put).toHaveBeenCalledWith(
      "/api/v1/configuracion/correo-acceso/politica/",
      payload,
    );
    expect(res.data.si_falta_elegido).toBe("usar_siguiente");
  });

  it("API client obtiene la vista previa masiva por grupo", async () => {
    get.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        total_evaluados: 10,
        cambian: 3,
        quedan_igual: 6,
        quedan_sin_cuenta: 1,
        excepciones_manuales_ignoradas: 2,
        items: [],
      },
    });

    const res = await correoAccesoApi.obtenerVistaPrevia("pasivos", false);
    expect(get).toHaveBeenCalledWith(
      "/api/v1/configuracion/correo-acceso/vista-previa/?grupo=pasivos&incluir_excepciones=false",
    );
    expect(res.data.total_evaluados).toBe(10);
    expect(res.data.cambian).toBe(3);
  });

  it("API client ejecuta la aplicación masiva con motivo", async () => {
    const payload = {
      grupo: "pasivos" as const,
      motivo: "Actualización general 2026",
      incluir_excepciones: false,
    };
    post.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        actualizados: 3,
        sin_cambio: 6,
        sin_cuenta: 1,
        total_procesados: 10,
        grupo: "pasivos",
        motivo: "Actualización general 2026",
      },
    });

    const res = await correoAccesoApi.aplicarMasivo(payload);
    expect(post).toHaveBeenCalledWith(
      "/api/v1/configuracion/correo-acceso/aplicar/",
      payload,
    );
    expect(res.data.actualizados).toBe(3);
  });
});
