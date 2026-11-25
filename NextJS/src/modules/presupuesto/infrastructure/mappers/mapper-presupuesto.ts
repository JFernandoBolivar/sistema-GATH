import type { HitoHistorial } from "@/modules/captacion/domain/expediente";
import type {
  AccionExpediente,
  Constancia,
  DetalleArea,
  FilaArea,
  FilaVacante,
  NombreRef,
  PaginaArea,
  PaginaVacantes,
  Puesto,
  PuntoCuenta,
  Reserva,
} from "../../domain/solicitud";

type Crudo = Record<string, unknown>;

const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const textoONulo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const numeroONulo = (v: unknown): number | null => (typeof v === "number" ? v : null);
const objeto = (v: unknown): Crudo => (v && typeof v === "object" && !Array.isArray(v) ? (v as Crudo) : {});
const lista = (v: unknown): Crudo[] => (Array.isArray(v) ? v.map(objeto) : []);

function ref(v: unknown): NombreRef {
  const o = objeto(v);
  return { id: numeroONulo(o.id), nombre: texto(o.nombre) };
}

export function filaAreaDesdeApi(f: Crudo): FilaArea {
  const p = objeto(f.postulante);
  const prop = objeto(f.propuesta);
  const reserva = f.reserva ? objeto(f.reserva) : null;
  const pc = f.punto_cuenta ? objeto(f.punto_cuenta) : null;
  return {
    id: texto(f.id),
    numero: texto(f.numero),
    estado: texto(f.estado),
    ultimoCambio: textoONulo(f.ultimo_cambio),
    esReingreso: f.es_reingreso === true,
    pendiente: f.pendiente === true,
    postulante: { cedula: texto(p.cedula), nombres: texto(p.nombres), apellidos: texto(p.apellidos) },
    cargoTexto: texto(prop.cargo_texto),
    oficinaTexto: texto(prop.oficina_texto),
    diferidoVenceEl: textoONulo(f.diferido_vence_el),
    reservaPuestoId: reserva ? numeroONulo(reserva.puesto_id) : null,
    reservaVenceEl: reserva ? textoONulo(reserva.vence_el) : null,
    tieneConstancia: f.tiene_constancia === true,
    puntoCuentaNumero: pc ? textoONulo(pc.numero) : null,
    puntoCuentaEstado: pc ? textoONulo(pc.estado) : null,
  };
}

export function paginaAreaDesdeApi(d: Crudo): PaginaArea {
  return {
    resultados: lista(d.resultados).map(filaAreaDesdeApi),
    total: numeroONulo(d.total) ?? 0,
    pagina: numeroONulo(d.pagina) ?? 1,
    tamano: numeroONulo(d.tamano) ?? 10,
    totalPaginas: numeroONulo(d.total_paginas) ?? 1,
  };
}

export function puestoDesdeApi(raw: unknown): Puesto | null {
  if (!raw || typeof raw !== "object") return null;
  const p = objeto(raw);
  return {
    id: numeroONulo(p.id) ?? 0,
    codigo: texto(p.codigo),
    vacante: p.vacante === true,
    cargo: ref(p.cargo),
    cargoEspecifico: ref(p.cargo_especifico),
    tipoNomina: ref(p.tipo_nomina),
    dependencia: ref(p.dependencia),
    direccionGeneral: ref(p.direccion_general),
    direccionLinea: ref(p.direccion_linea),
    coordinacion: ref(p.coordinacion),
  };
}

export function reservaDesdeApi(raw: unknown): Reserva | null {
  if (!raw || typeof raw !== "object") return null;
  const r = objeto(raw);
  return {
    id: texto(r.id),
    puestoId: numeroONulo(r.puesto_id) ?? 0,
    estado: texto(r.estado),
    reservadoPor: texto(r.reservado_por),
    reservadoEl: textoONulo(r.reservado_el),
    venceEl: textoONulo(r.vence_el),
    vigente: r.vigente === true,
    puesto: puestoDesdeApi(r.puesto),
  };
}

function constanciaDesdeApi(raw: unknown): Constancia | null {
  if (!raw || typeof raw !== "object") return null;
  const c = objeto(raw);
  return {
    referencia: texto(c.referencia),
    observaciones: texto(c.observaciones),
    fecha: textoONulo(c.fecha),
    declaradoPorCedula: texto(c.declarado_por_cedula),
    declaradoPorNombre: texto(c.declarado_por_nombre),
    tieneAdjunto: c.tiene_adjunto === true,
    adjuntoTamano: numeroONulo(c.adjunto_tamano),
  };
}

export function puntoCuentaDesdeApi(raw: unknown): PuntoCuenta | null {
  if (!raw || typeof raw !== "object") return null;
  const p = objeto(raw);
  return {
    id: texto(p.id),
    numero: texto(p.numero),
    estado: texto(p.estado),
    referenciaConstancia: texto(p.referencia_constancia),
    emitidoPor: texto(p.emitido_por),
    emitidoEl: textoONulo(p.emitido_el),
    decididoPor: texto(p.decidido_por),
    decididoEl: textoONulo(p.decidido_el),
    tieneDocumento: p.tiene_documento === true,
  };
}

function accionDesdeApi(a: Crudo): AccionExpediente {
  return {
    destino: texto(a.destino),
    etiqueta: texto(a.etiqueta),
    requiereMotivo: a.requiere_motivo === true,
    requierePropuesta: false,
    bloqueada: a.bloqueada === true,
    motivoBloqueo: texto(a.motivo_bloqueo),
    sugerida: a.sugerida === true,
  };
}

function hitoDesdeApi(h: Crudo): HitoHistorial {
  return {
    estadoOrigen: textoONulo(h.estado_origen),
    estadoDestino: texto(h.estado_destino),
    fecha: texto(h.fecha),
    actorCedula: texto(h.actor_cedula),
    actorTipo: texto(h.actor_tipo),
    motivo: texto(h.motivo),
  };
}

export function detalleAreaDesdeApi(d: Crudo): DetalleArea {
  const e = objeto(d.expediente);
  const p = objeto(d.postulante);
  const pr = objeto(e.propuesta);
  const docs = objeto(d.documentos);
  const cap = objeto(d.capacidades);
  const nombres: Record<string, string> = {};
  for (const [k, v] of Object.entries(objeto(pr.nombres))) if (typeof v === "string") nombres[k] = v;
  return {
    expediente: {
      id: texto(e.id),
      numero: texto(e.numero),
      estado: texto(e.estado),
      fechaApertura: textoONulo(e.fecha_apertura),
      fechaCierre: textoONulo(e.fecha_cierre),
      observaciones: texto(e.observaciones),
      esReingreso: e.es_reingreso === true,
      reservaVenceEl: textoONulo(e.reserva_vence_el),
      diferidoVenceEl: textoONulo(e.diferido_vence_el),
      propuesta: {
        cargoId: numeroONulo(pr.cargo_id),
        cargoEspecificoId: numeroONulo(pr.cargo_especifico_id),
        tipoNominaId: numeroONulo(pr.tipo_nomina_id),
        direccionGeneralId: numeroONulo(pr.direccion_general_id),
        direccionLineaId: numeroONulo(pr.direccion_linea_id),
        coordinacionId: numeroONulo(pr.coordinacion_id),
        dependenciaId: numeroONulo(pr.dependencia_id),
        cargoTexto: texto(pr.cargo_texto),
        oficinaTexto: texto(pr.oficina_texto),
        nombres,
      },
    },
    postulante: {
      id: texto(p.id),
      cedula: texto(p.cedula),
      nombres: texto(p.nombres),
      apellidos: texto(p.apellidos),
      esReingreso: p.es_reingreso === true,
    },
    reserva: reservaDesdeApi(d.reserva),
    constancia: constanciaDesdeApi(d.constancia),
    puntoCuenta: puntoCuentaDesdeApi(d.punto_cuenta),
    documentos: { puntoCuenta: textoONulo(docs.punto_cuenta), constanciaAdjunto: textoONulo(docs.constancia_adjunto) },
    historial: lista(d.historial).map(hitoDesdeApi),
    acciones: lista(d.acciones).map(accionDesdeApi),
    capacidades: {
      puedeReservar: cap.puede_reservar === true,
      puedeDeclararDisponibilidad: cap.puede_declarar_disponibilidad === true,
    },
  };
}

export function paginaVacantesDesdeApi(d: Crudo): PaginaVacantes {
  const filtros = objeto(d.filtros);
  return {
    resultados: lista(d.resultados).map((f): FilaVacante => ({ ...(puestoDesdeApi(f) as Puesto), reservaPropia: f.reserva_propia === true })),
    total: numeroONulo(d.total) ?? 0,
    pagina: numeroONulo(d.pagina) ?? 1,
    tamano: numeroONulo(d.tamano) ?? 10,
    totalPaginas: numeroONulo(d.total_paginas) ?? 1,
    deLaPropuesta: filtros.de_propuesta === true,
    reserva: reservaDesdeApi(d.reserva),
  };
}
