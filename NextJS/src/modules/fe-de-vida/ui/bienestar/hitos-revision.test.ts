import { describe, expect, it, vi } from "vitest";

vi.mock("../../infrastructure/actions/fe-de-vida-actions", () => ({
  descargarConstanciaAction: vi.fn(),
}));

import { hitosRevision } from "./hitos-revision";
import type { SolicitudDTO } from "../../application/dtos/fe-de-vida-dto";

function fakeSolicitud(p: Partial<SolicitudDTO> = {}): SolicitudDTO {
  return {
    id: "sol-1",
    procesoId: "proc-1",
    cedula: "V-12345678",
    nombre: "Pedro Pérez",
    estado: "BORRADOR",
    version: 1,
    envios: 0,
    origenEvidencia: null,
    tieneEvidencia: false,
    viaAprobacion: null,
    requiereNuevaFoto: false,
    fechaEnvio: null,
    fechaValidacion: null,
    decisiones: [],
    canal: "EN_LINEA",
    registradaPorCedula: undefined,
    ...p,
  };
}

describe("hitosRevision", () => {
  it("en estado BORRADOR refleja que aún no ha enviado y la revisión queda pendiente", () => {
    const s = fakeSolicitud({ estado: "BORRADOR", fechaEnvio: null });
    const hitos = hitosRevision(s);

    const primerHito = hitos.find((h) => h.id === "enviada");
    expect(primerHito).toBeDefined();
    expect(primerHito?.titulo).toBe("Aún no enviada (borrador)");
    expect(primerHito?.fecha).toBeUndefined();
    expect(primerHito?.estado).toBe("actual");

    const revisionHito = hitos.find((h) => h.id === "revision");
    expect(revisionHito).toBeDefined();
    expect(revisionHito?.estado).toBe("pendiente");
  });

  it("en estado enviado muestra 'Fe de vida enviada' con fecha y estado hecho", () => {
    const s = fakeSolicitud({
      estado: "PENDIENTE_REVISION",
      fechaEnvio: "2026-11-06T10:00:00Z",
      envios: 1,
    });
    const hitos = hitosRevision(s);

    const primerHito = hitos.find((h) => h.id === "enviada");
    expect(primerHito).toBeDefined();
    expect(primerHito?.titulo).toBe("Fe de vida enviada");
    expect(primerHito?.fecha).toBeTruthy();
    expect(primerHito?.estado).toBe("hecho");

    const revisionHito = hitos.find((h) => h.id === "revision");
    expect(revisionHito).toBeDefined();
    expect(revisionHito?.estado).toBe("actual");
  });
});
