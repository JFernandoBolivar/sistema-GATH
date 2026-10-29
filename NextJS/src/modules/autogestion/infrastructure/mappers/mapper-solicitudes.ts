import {
  ESTADOS_SOLICITUD,
  type AccionCambio,
  type CambioEntity,
  type DatosComplementariosEntity,
  type DecisionCambio,
  type EstadoSolicitud,
  type PaginaSolicitudesEntity,
  type ProrrogaEntity,
  type SeccionAutogestionEntity,
  type SolicitudDetalleEntity,
  type SolicitudEntity,
  type SoporteEntity,
  type ValorCambio,
} from "../../domain/entities/solicitud-actualizacion";
import type {
  CambioApi,
  DatosComplementariosApi,
  DetalleSolicitudApi,
  PaginaSolicitudesApi,
  ProrrogaApi,
  SeccionApi,
  SolicitudApi,
  SoporteApi,
} from "../http/solicitudes-api";

function aEstado(valor: string): EstadoSolicitud {
  const estado = ESTADOS_SOLICITUD.find((e) => e === valor);
  if (!estado) throw new Error(`El servidor devolvió un estado de solicitud desconocido: ${valor}`);
  return estado;
}

function aDecision(valor: string): DecisionCambio {
  if (valor === "APROBADO" || valor === "RECHAZADO" || valor === "PENDIENTE") return valor;
  throw new Error(`El servidor devolvió una decisión desconocida: ${valor}`);
}

function aAccion(valor: string): AccionCambio {
  if (valor === "MODIFICAR" || valor === "CREAR") return valor;
  throw new Error(`El servidor devolvió una acción desconocida: ${valor}`);
}

export function mapperSolicitud(r: SolicitudApi): SolicitudEntity {
  return {
    id: r.id,
    cedula: r.cedula,
    estado: aEstado(r.estado),
    seccionesSolicitadas: r.secciones_solicitadas ?? [],
    seccionesHabilitadas: r.secciones_habilitadas ?? [],
    motivo: r.motivo ?? "",
    ventanaInicio: r.ventana_inicio,
    ventanaFin: r.ventana_fin,
    plazoDias: r.plazo_dias,
    habilitadaPor: r.habilitada_por ?? "",
    decididaPor: r.decidida_por ?? "",
    motivoDecision: r.motivo_decision ?? "",
    version: r.version,
    fechaSolicitud: r.fecha_solicitud,
    fechaEnvio: r.fecha_envio,
    fechaDecision: r.fecha_decision,
  };
}

export function mapperCambio(r: CambioApi): CambioEntity {
  return {
    id: r.id,
    seccion: r.seccion,
    accion: aAccion(r.accion),
    entidadDestino: r.entidad_destino,
    entidadId: r.entidad_id,
    campo: r.campo,
    valorAnterior: (r.valor_anterior ?? null) as ValorCambio,
    valorPropuesto: (r.valor_propuesto ?? null) as ValorCambio,
    valorActual: (r.valor_actual ?? null) as ValorCambio,
    conflicto: Boolean(r.conflicto),
    decision: aDecision(r.decision),
    motivoDecision: r.motivo_decision ?? "",
    decididoPor: r.decidido_por ?? "",
    fechaDecision: r.fecha_decision,
  };
}

export function mapperSoporte(r: SoporteApi): SoporteEntity {
  return {
    id: r.id,
    seccion: r.seccion,
    tipo: r.tipo,
    mimeReal: r.mime_real,
    tamanoBytes: r.tamano_bytes,
    nombreOriginal: r.nombre_original,
    fecha: r.fecha,
    urlArchivo: r.url_archivo,
  };
}

function mapperProrroga(r: ProrrogaApi): ProrrogaEntity {
  return {
    id: r.id,
    fechaFinAnterior: r.fecha_fin_anterior,
    fechaFinNueva: r.fecha_fin_nueva,
    motivo: r.motivo,
    prorrogadaPor: r.prorrogada_por,
    fecha: r.fecha,
  };
}

export function mapperDetalle(r: DetalleSolicitudApi): SolicitudDetalleEntity {
  return {
    ...mapperSolicitud(r),
    cambios: (r.cambios ?? []).map(mapperCambio),
    soportes: (r.soportes ?? []).map(mapperSoporte),
    prorrogas: (r.prorrogas ?? []).map(mapperProrroga),
  };
}

export function mapperPagina(r: PaginaSolicitudesApi): PaginaSolicitudesEntity {
  return {
    count: r.count,
    limit: r.limit,
    offset: r.offset,
    results: r.results.map(mapperSolicitud),
  };
}

export function mapperSeccion(r: SeccionApi): SeccionAutogestionEntity {
  return {
    codigo: r.codigo,
    nombre: r.nombre,
    requiereSoporte: r.requiere_soporte,
    activa: r.activa,
  };
}

export function mapperDatosComplementarios(r: DatosComplementariosApi): DatosComplementariosEntity {
  return {
    cedula: r.cedula,
    correoAlternativo: r.correo_alternativo,
    tieneHijos: r.tiene_hijos,
    actualizadoEn: r.actualizado_en,
    actualizadoPor: r.actualizado_por,
  };
}
