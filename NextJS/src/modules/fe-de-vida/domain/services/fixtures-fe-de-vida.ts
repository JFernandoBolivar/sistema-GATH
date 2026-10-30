import type { DecisionEntity, SolicitudEntity } from "../entities/fe-de-vida";

export function decisionFake(p: Partial<DecisionEntity> = {}): DecisionEntity {
  return { tipo: "CHECK", rol: "ANALISTA", actorCedula: "111", envio: 1, motivo: "", fecha: null, ...p };
}

export function solicitudFake(p: Partial<SolicitudEntity> = {}): SolicitudEntity {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    procesoId: "00000000-0000-4000-8000-0000000000aa",
    cedula: "12345678",
    nombre: "Ana Pérez",
    estado: "PENDIENTE_REVISION",
    version: 1,
    envios: 1,
    origenEvidencia: "ARCHIVO",
    tieneEvidencia: true,
    viaAprobacion: null,
    requiereNuevaFoto: false,
    fechaEnvio: "2026-10-29T15:00:00Z",
    fechaValidacion: null,
    decisiones: [],
    ...p,
  };
}
