import { describe, expect, it } from "vitest";

import { solicitudDesdeApi, type SolicitudCarnetApi } from "./solicitud-carnet";

const BASE: SolicitudCarnetApi = {
  id: "s-1",
  cedula: "12345678",
  estado: "PENDIENTE",
  motivo_id: 2,
  motivo: "REPOSICIÓN",
  justificacion: "Lo perdí",
  motivo_rechazo: "",
  carnet_id: null,
  fecha_solicitud: "2026-11-20T10:00:00+00:00",
  fecha_resolucion: null,
  nombres: "ANA MARÍA",
  apellidos: "PÉREZ LUNA",
  cargo: "ANALISTA",
  departamento: "TALENTO HUMANO",
  condicion: "PASIVO",
  carnet_anterior_estado: "VENCIDO",
};

describe("solicitudDesdeApi", () => {
  it("convierte la fila del backend a la forma de la bandeja", () => {
    const item = solicitudDesdeApi(BASE);
    expect(item.nombreCompleto).toBe("PÉREZ LUNA, ANA MARÍA");
    expect(item.poblacion).toBe("PASIVO");
    expect(item.motivoId).toBe(2);
    expect(item.motivoSolicitud).toBe("REPOSICIÓN");
    expect(item.motivoRechazo).toBeUndefined();
    expect(item.carnetAnteriorEstado).toBe("VENCIDO");
  });

  it("tolera datos faltantes del titular", () => {
    const item = solicitudDesdeApi({ ...BASE, nombres: "", apellidos: "", cargo: "", condicion: undefined });
    expect(item.nombreCompleto).toBe("12345678");
    expect(item.cargo).toBe("No especificado");
    expect(item.poblacion).toBe("ACTIVO");
  });
});
