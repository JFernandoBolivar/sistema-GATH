import { beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { get },
}));

import { puntoCuentaApi } from "../infrastructure/http/puntocuenta-api";

beforeEach(() => {
  get.mockReset();
});

describe("Módulo Punto de Cuenta - API", () => {
  it("API client construye los endpoints correctos con filtros", async () => {
    get.mockResolvedValue({
      status: "success",
      message: "ok",
      data: [
        {
          id: "pc-1",
          numero: "0001-2026",
          anio: 2026,
          secuencia: 1,
          cargo_id: 10,
          empleado_cedula: "12345678",
          empleado_nombre: "Juan Perez",
          dependencia_origen_id: 1,
          dependencia_origen_nombre: "Nivel Central",
          dependencia_destino_id: 1,
          dependencia_destino_nombre: "Nivel Central",
          oficina_origen_id: 2,
          oficina_origen: "Gerencia A",
          oficina_destino_id: 3,
          oficina_destino: "Gerencia B",
          motivo_id: 1,
          motivo_nombre: "Traslado",
          usuario_id: 5,
          fecha: "2026-11-04T10:00:00",
          documento_generado: true,
        },
      ],
    });

    const resultado = await puntoCuentaApi.listar({ cedula: "12345678", oficina_id: 2 });
    expect(get).toHaveBeenCalledWith("/api/v1/puntocuenta/?cedula=12345678&oficina_id=2");
    expect(resultado.data).toHaveLength(1);
    expect(resultado.data[0].numero).toBe("0001-2026");
  });

});
