import type {
  CambioEntity,
  CoberturaEntity,
  DecisionEntity,
  DetalleSolicitudEntity,
  PaginaEntity,
  ProcesoEntity,
  ProrrogaEntity,
  SolicitudEntity,
  UrlEvidenciaEntity,
  VigenteEntity,
} from "../../domain/entities/fe-de-vida";
import {
  esEstadoProceso,
  esEstadoSolicitud,
  type EstadoSolicitud,
  type TipoDecision,
} from "../../domain/value-objects/estados";
import type {
  CambioApi,
  CoberturaApi,
  DecisionApi,
  DetalleApi,
  PaginaApi,
  ProcesoApi,
  ProrrogaApi,
  SolicitudApi,
  UrlEvidenciaApi,
  VigenteApi,
} from "../http/fe-de-vida-api";

const TIPOS_DECISION: readonly TipoDecision[] = ["CHECK", "APROBACION_DIRECTA", "RECHAZO", "DEVOLUCION"];

/** `REPETICION_SOLICITADA` es el nombre previo de `DEVUELTA`; se tolera mientras convivan versiones. */
export function mapperEstadoSolicitud(valor: string): EstadoSolicitud {
  if (valor === "REPETICION_SOLICITADA") return "DEVUELTA";
  return esEstadoSolicitud(valor) ? valor : "BORRADOR";
}

function mapperTipoDecision(valor: string): TipoDecision {
  if (valor === "REPETICION") return "DEVOLUCION";
  return (TIPOS_DECISION as readonly string[]).includes(valor) ? (valor as TipoDecision) : "CHECK";
}

export function mapperDecision(d: DecisionApi): DecisionEntity {
  return {
    tipo: mapperTipoDecision(d.tipo),
    rol: d.rol ?? "",
    actorCedula: d.actor_cedula ?? "",
    envio: d.envio ?? 0,
    motivo: d.motivo ?? "",
    fecha: d.fecha ?? null,
  };
}

export function mapperSolicitud(s: SolicitudApi): SolicitudEntity {
  const origen = s.origen_evidencia === "CAMARA" || s.origen_evidencia === "ARCHIVO" ? s.origen_evidencia : null;
  return {
    id: s.id,
    procesoId: s.proceso_id,
    cedula: s.cedula,
    nombre: s.nombre ?? "",
    estado: mapperEstadoSolicitud(s.estado),
    version: s.version ?? 0,
    envios: s.envios ?? 0,
    origenEvidencia: origen,
    tieneEvidencia: !!s.tiene_evidencia,
    viaAprobacion: s.via_aprobacion ?? null,
    requiereNuevaFoto: !!s.requiere_nueva_foto,
    fechaEnvio: s.fecha_envio ?? null,
    fechaValidacion: s.fecha_validacion ?? null,
    decisiones: (s.decisiones ?? []).map(mapperDecision),
  };
}

export function mapperCambio(c: CambioApi): CambioEntity {
  return {
    id: c.id,
    seccion: c.seccion,
    accion: c.accion,
    entidad: c.entidad,
    entidadId: c.entidad_id ?? null,
    campo: c.campo,
    valorAnterior: c.valor_anterior ?? null,
    valorPropuesto: c.valor_propuesto ?? null,
    valorActual: c.valor_actual ?? null,
    conflicto: !!c.conflicto,
  };
}

export function mapperDetalle(d: DetalleApi): DetalleSolicitudEntity {
  return { solicitud: mapperSolicitud(d.solicitud), cambios: (d.cambios ?? []).map(mapperCambio) };
}

export function mapperProceso(p: ProcesoApi): ProcesoEntity {
  return {
    id: p.id,
    nombre: p.nombre,
    estado: esEstadoProceso(p.estado) ? p.estado : "BORRADOR",
    apertura: p.apertura ?? p.fecha_apertura ?? null,
    cierre: p.cierre ?? p.fecha_cierre ?? null,
    cierreReal: p.fecha_cierre_real ?? null,
    tiposNomina: (p.tipos_nomina ?? []).map((t) => ({ id: t.id, nombre: t.nombre })),
    diasRecordatorio: [...(p.dias_recordatorio ?? [])],
  };
}

export function mapperVigente(v: VigenteApi | null): VigenteEntity | null {
  if (!v || !v.proceso) return null;
  return {
    proceso: mapperProceso(v.proceso),
    solicitud: v.solicitud ? mapperSolicitud(v.solicitud) : null,
    puedeEnviar: !!v.puede_enviar,
  };
}

export function mapperProrroga(p: ProrrogaApi): ProrrogaEntity {
  return {
    id: p.id,
    procesoId: p.proceso_id,
    cedula: p.cedula ?? "",
    general: !!p.general,
    nuevaFechaLimite: p.nueva_fecha_limite ?? null,
    motivo: p.motivo ?? "",
    concedidaPor: p.concedida_por ?? "",
  };
}

export function mapperCobertura(c: CoberturaApi): CoberturaEntity {
  return {
    cedula: c.cedula,
    nombreCompleto: c.nombre_completo,
    tipoNomina: c.tipo_nomina ?? "",
    correo: c.correo ?? "",
    sinCorreo: !!c.sin_correo,
    tieneCuenta: !!c.tiene_cuenta,
  };
}

export function mapperUrlEvidencia(u: UrlEvidenciaApi): UrlEvidenciaEntity {
  return { url: u.url, expiraEnSegundos: u.expira_en_segundos };
}

export function mapperPagina<A, E>(p: PaginaApi<A>, fn: (a: A) => E): PaginaEntity<E> {
  return { count: p.count ?? 0, limit: p.limit ?? 10, offset: p.offset ?? 0, results: (p.results ?? []).map(fn) };
}
