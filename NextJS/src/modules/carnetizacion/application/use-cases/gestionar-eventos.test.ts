import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import {
  checkInAcceso,
  crearEvento,
  getEventos,
  importarInvitados,
} from "./gestionar-eventos";

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    postForm: vi.fn(),
  },
}));

describe("Casos de uso de Eventos y Control de Entrada (O45-B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getEventos consulta endpoint con filtros y retorna la lista", async () => {
    const eventosMock = [
      {
        id: "ev-1",
        nombre: "FITELVEN 2026",
        lugar: "Poliedro de Caracas",
        fecha_inicio: "2026-11-10T08:00:00Z",
        fecha_fin: "2026-11-12T18:00:00Z",
        estado: "activo",
      },
    ];

    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: "success",
      message: "OK",
      data: eventosMock,
    });

    const resultado = await getEventos({ estado: "activo" });

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/v1/carnetizacion/eventos/",
      expect.objectContaining({ params: { estado: "activo" } })
    );
    expect(resultado).toEqual(eventosMock);
  });

  it("crearEvento envía datos y retorna el evento creado", async () => {
    const nuevoMock = {
      id: "ev-2",
      nombre: "Cumbre Satelital",
      lugar: "Auditorio Conatel",
      fecha_inicio: "2026-12-01T09:00:00Z",
      fecha_fin: "2026-12-01T17:00:00Z",
      estado: "activo",
    };

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      status: "success",
      message: "Creado",
      data: nuevoMock,
    });

    const res = await crearEvento({
      nombre: "Cumbre Satelital",
      lugar: "Auditorio Conatel",
      fecha_inicio: "2026-12-01T09:00:00Z",
      fecha_fin: "2026-12-01T17:00:00Z",
    });

    expect(res).toEqual(nuevoMock);
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/carnetizacion/eventos/",
      expect.objectContaining({ nombre: "Cumbre Satelital" })
    );
  });

  it("checkInAcceso procesa validación de QR canónica", async () => {
    const checkInMock = {
      resultado: "ACCESO_PERMITIDO" as const,
      mensaje: "Acceso permitido. Bienvenido(a).",
      invitado_id: "inv-123",
      nombre_completo: "Carlos Mendoza",
      categoria_nombre: "Invitado Especial",
      zona_nombre: "Salón Principal",
      hora_ingreso_formateada: "09:15 AM",
    };

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      status: "success",
      message: "OK",
      data: checkInMock,
    });

    const res = await checkInAcceso({
      codigo_o_hash: "hash_qr_12345",
      evento_id: "ev-1",
    });

    expect(res.resultado).toBe("ACCESO_PERMITIDO");
    expect(res.nombre_completo).toBe("Carlos Mendoza");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/carnetizacion/control-eventos/check-in/",
      {
        codigo_o_hash: "hash_qr_12345",
        evento_id: "ev-1",
      }
    );
  });

  it("importarInvitados envía archivo multipart y retorna resumen", async () => {
    const resumenMock = {
      total_filas: 5,
      filas_validas: 5,
      filas_invalidas: 0,
      filas: [],
    };

    vi.mocked(apiClient.postForm).mockResolvedValueOnce({
      status: "success",
      message: "OK",
      data: resumenMock,
    });

    const fakeFile = new File(["nombre,categoria\nCarlos,Prensa"], "invitados.csv", {
      type: "text/csv",
    });

    const res = await importarInvitados("ev-1", {
      archivo: fakeFile,
      confirmar: true,
    });

    expect(res.total_filas).toBe(5);
    expect(apiClient.postForm).toHaveBeenCalledWith(
      "/api/v1/carnetizacion/eventos/ev-1/invitados/importar/",
      expect.any(FormData)
    );
  });
});
