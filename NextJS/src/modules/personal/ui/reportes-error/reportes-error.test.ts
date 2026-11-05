import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { get, post },
}));

import { personalApi } from "../../infrastructure/http/personal-api";

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe("Módulo Personal - Reportes de Error Laboral (A11 / D20)", () => {
  it("crearReporteErrorLaboral envía payload correcto a la API", async () => {
    const mockRes = {
      status: "success",
      message: "Reporte creado",
      data: {
        id: "rep-123",
        trabajador_cedula: "12345678",
        trabajador_nombre: "Juan Perez",
        dato: "cargo",
        descripcion: "El cargo real no coincide con el sistema.",
        estado: "PENDIENTE",
        creado_el: "2026-11-01T10:00:00Z",
        actualizado_el: "2026-11-01T10:00:00Z",
      },
    };
    post.mockResolvedValue(mockRes);

    const resultado = await personalApi.crearReporteErrorLaboral({
      dato: "cargo",
      descripcion: "El cargo real no coincide con el sistema.",
    });

    expect(post).toHaveBeenCalledWith("/api/v1/personal/reportes-error/crear/", {
      dato: "cargo",
      descripcion: "El cargo real no coincide con el sistema.",
    });
    expect(resultado.id).toBe("rep-123");
    expect(resultado.dato).toBe("cargo");
    expect(resultado.estado).toBe("PENDIENTE");
  });

  it("getReportesErrorLaboral envía filtros por estado y dato", async () => {
    const mockList = {
      status: "success",
      message: "Listado",
      data: [
        {
          id: "rep-1",
          trabajador_cedula: "11111111",
          trabajador_nombre: "Maria Gonzalez",
          dato: "oficina",
          descripcion: "Oficina desactualizada.",
          estado: "PENDIENTE",
          creado_el: "2026-11-02T10:00:00Z",
          actualizado_el: "2026-11-02T10:00:00Z",
        },
      ],
    };
    get.mockResolvedValue(mockList);

    const resultado = await personalApi.getReportesErrorLaboral({
      estado: "PENDIENTE",
      dato: "oficina",
    });

    expect(get).toHaveBeenCalledWith("/api/v1/personal/reportes-error/", {
      params: { estado: "PENDIENTE", dato: "oficina" },
    });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].dato).toBe("oficina");
  });

  it("atenderReporteErrorLaboral llama endpoint de atención con id y observaciones", async () => {
    const mockRes = {
      status: "success",
      message: "Atendido",
      data: {
        id: "rep-1",
        trabajador_cedula: "11111111",
        trabajador_nombre: "Maria Gonzalez",
        dato: "oficina",
        descripcion: "Oficina desactualizada.",
        estado: "ATENDIDO",
        creado_el: "2026-11-02T10:00:00Z",
        actualizado_el: "2026-11-04T12:00:00Z",
        atendido_por_cedula: "20000001",
        atendido_por_nombre: "Analista RRHH",
        observacion_atencion: "Corregido en nómina.",
      },
    };
    post.mockResolvedValue(mockRes);

    const resultado = await personalApi.atenderReporteErrorLaboral("rep-1", {
      observaciones: "Corregido en nómina.",
    });

    expect(post).toHaveBeenCalledWith("/api/v1/personal/reportes-error/rep-1/atender/", {
      observaciones: "Corregido en nómina.",
    });
    expect(resultado.estado).toBe("ATENDIDO");
    expect(resultado.atendido_por_cedula).toBe("20000001");
  });
});
