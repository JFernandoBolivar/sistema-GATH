import type {
  CambioEntity,
  SolicitudDetalleEntity,
  SolicitudEntity,
} from "../entities/solicitud-actualizacion";

/** Constructores de datos de prueba (solo para tests). */
export function solicitudFake(parcial: Partial<SolicitudEntity> = {}): SolicitudEntity {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    cedula: "12345678",
    estado: "SOLICITADA",
    seccionesSolicitadas: ["contacto"],
    seccionesHabilitadas: [],
    motivo: "Cambié de número de teléfono móvil",
    ventanaInicio: null,
    ventanaFin: null,
    plazoDias: null,
    habilitadaPor: "",
    decididaPor: "",
    motivoDecision: "",
    version: 1,
    fechaSolicitud: "2026-10-01T12:00:00Z",
    fechaEnvio: null,
    fechaDecision: null,
    camposSolicitados: ["employee.telefono_movil"],
    camposHabilitados: [],
    motivoDevolucion: "",
    devueltaPor: "",
    fechaDevolucion: null,
    ...parcial,
  };
}

export function cambioFake(parcial: Partial<CambioEntity> = {}): CambioEntity {
  return {
    id: "c1",
    seccion: "contacto",
    accion: "MODIFICAR",
    entidadDestino: "employee",
    entidadId: null,
    campo: "telefono_movil",
    valorAnterior: "0412-0000000",
    valorPropuesto: "0414-1111111",
    valorActual: "0412-0000000",
    conflicto: false,
    decision: "PENDIENTE",
    motivoDecision: "",
    decididoPor: "",
    fechaDecision: null,
    ...parcial,
  };
}

export function detalleFake(parcial: Partial<SolicitudDetalleEntity> = {}): SolicitudDetalleEntity {
  return { ...solicitudFake(), cambios: [], soportes: [], prorrogas: [], ...parcial };
}
