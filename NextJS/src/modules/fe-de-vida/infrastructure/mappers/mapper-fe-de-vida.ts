import type {
  CambioEntity,
  CoberturaEntity,
  ContactoEmergenciaFicha,
  DecisionEntity,
  DetalleRevisionEntity,
  DetalleSolicitudEntity,
  FamiliarFicha,
  FichaPasivoEntity,
  PaginaEntity,
  ProcesoEntity,
  ProrrogaEntity,
  SolicitudEntity,
  VigenteEntity,
} from "../../domain/entities/fe-de-vida";
import {
  ACCIONES_REVISION,
  esEstadoProceso,
  esEstadoSolicitud,
  type AccionRevision,
  type EstadoSolicitud,
  type TipoDecision,
} from "../../domain/value-objects/estados";
import type {
  CambioApi,
  CoberturaApi,
  DecisionApi,
  DetalleApi,
  DetalleRevisionApi,
  FichaApi,
  PaginaApi,
  ProcesoApi,
  ProrrogaApi,
  SolicitudApi,
  VigenteApi,
} from "../http/fe-de-vida-api";

const TIPOS_DECISION: readonly TipoDecision[] = [
  "CHECK",
  "CHECK_RETIRADO",
  "APROBACION_DIRECTA",
  "RECHAZO",
  "DEVOLUCION",
];

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
    actorNombre: d.actor_nombre || d.actor_cedula || "",
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

const texto = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

function nombreFamiliar(f: NonNullable<FichaApi["familiares"]>[number]): string {
  return [f.primer_nombre, f.segundo_nombre, f.primer_apellido, f.segundo_apellido]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

/** Ficha del pasivo: la asignación vigente es la primera; ingreso/egreso salen del antecedente más reciente. */
export function mapperFicha(f: FichaApi): FichaPasivoEntity {
  const e = f.empleado ?? {};
  const asig = e.asignaciones?.[0];
  const v = e.datos_vivienda;
  const antecedente = e.antecedentes?.[0];
  return {
    cedula: e.cedula ?? "",
    nombres: e.nombres ?? "",
    apellidos: e.apellidos ?? "",
    sexo: texto(e.sexo_nombre),
    fechaNacimiento: texto(e.fecha_nacimiento),
    correo: texto(e.correo),
    correoAlternativo: texto(f.datos_complementarios?.correo_alternativo),
    telefonoMovil: texto(e.telefono_movil),
    telefonoHabitacion: texto(e.telefono_habitacion),
    asignacion: asig
      ? {
          tipoNomina: texto(asig.tipo_nomina),
          cargo: texto(asig.denominacion_cargo),
          dependencia: asig.dependencia ?? null,
          direccionGeneral: asig.direccion_general ?? null,
          direccionLinea: asig.direccion_linea ?? null,
          coordinacion: asig.coordinacion ?? null,
        }
      : null,
    fechaIngreso: texto(antecedente?.fecha_ingreso),
    fechaEgreso: texto(antecedente?.fecha_egreso),
    vivienda: v
      ? {
          estadoId: v.estado_id ?? null,
          municipioId: v.municipio_id ?? null,
          estado: texto(v.estado_nombre),
          municipio: texto(v.municipio_nombre),
          parroquia: texto(v.parroquia_nombre),
          codigoPostal: texto(v.codigo_postal_nombre),
          direccion: texto(v.direccion_exacta),
          condicion: texto(v.condicion_vivienda_nombre),
        }
      : null,
    contactosEmergencia: (e.contacto_emergencia ?? []).map(
      (c): ContactoEmergenciaFicha => ({
        id: String(c.id),
        nombres: c.nombres ?? "",
        apellidos: c.apellidos ?? "",
        parentesco: texto(c.relacion_nombre),
        telefono: texto(c.telefono),
      }),
    ),
    familiares: (f.familiares ?? []).map(
      (x): FamiliarFicha => ({
        id: String(x.id),
        nombre: nombreFamiliar(x),
        parentesco: texto(x.parentesco_nombre),
        cedula: texto(x.cedula_familiar),
        fechaNacimiento: texto(x.fecha_nacimiento),
      }),
    ),
    tieneHijos: f.datos_complementarios?.tiene_hijos ?? null,
  };
}

export function mapperDetalleRevision(d: DetalleRevisionApi): DetalleRevisionEntity {
  return {
    ...mapperDetalle(d),
    procesoNombre: d.proceso_nombre ?? "",
    ficha: d.ficha ? mapperFicha(d.ficha) : null,
    acciones: (d.acciones_disponibles ?? []).filter((a): a is AccionRevision =>
      (ACCIONES_REVISION as readonly string[]).includes(a),
    ),
  };
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

export function mapperPagina<A, E>(p: PaginaApi<A>, fn: (a: A) => E): PaginaEntity<E> {
  return { count: p.count ?? 0, limit: p.limit ?? 10, offset: p.offset ?? 0, results: (p.results ?? []).map(fn) };
}
