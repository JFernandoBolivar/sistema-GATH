import type {
  AccionExpediente,
  AltaPostulanteResultado,
  CredencialEmitida,
  DetalleExpediente,
  FilaBandeja,
  HitoHistorial,
  PaginaBandeja,
  PropuestaCargo,
  ResultadoPsicofisico,
} from "../../domain/expediente";

type Crudo = Record<string, unknown>;

const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const textoONulo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const numeroONulo = (v: unknown): number | null => (typeof v === "number" ? v : null);
const objeto = (v: unknown): Crudo => (v && typeof v === "object" && !Array.isArray(v) ? (v as Crudo) : {});
const lista = (v: unknown): Crudo[] => (Array.isArray(v) ? v.map(objeto) : []);

export function filaDesdeApi(f: Crudo): FilaBandeja {
  const p = objeto(f.postulante);
  return {
    id: texto(f.id),
    numero: texto(f.numero),
    estado: texto(f.estado),
    ventana: numeroONulo(f.ventana),
    venceEl: textoONulo(f.vence_el),
    ultimoCambio: textoONulo(f.ultimo_cambio),
    esReingreso: f.es_reingreso === true,
    pendienteDeCaptacion: f.pendiente_de_captacion === true,
    postulante: { cedula: texto(p.cedula), nombres: texto(p.nombres), apellidos: texto(p.apellidos) },
  };
}

export function paginaDesdeApi(d: Crudo): PaginaBandeja {
  return {
    resultados: lista(d.resultados).map(filaDesdeApi),
    total: numeroONulo(d.total) ?? 0,
    pagina: numeroONulo(d.pagina) ?? 1,
    tamano: numeroONulo(d.tamano) ?? 10,
    totalPaginas: numeroONulo(d.total_paginas) ?? 1,
  };
}

export function accionDesdeApi(a: Crudo): AccionExpediente {
  return {
    destino: texto(a.destino),
    etiqueta: texto(a.etiqueta),
    requiereMotivo: a.requiere_motivo === true,
    requierePropuesta: a.requiere_propuesta === true,
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

export function psicofisicoDesdeApi(raw: unknown): ResultadoPsicofisico {
  const p = objeto(raw);
  const resultado = p.resultado === "APTO" || p.resultado === "NO_APTO" ? p.resultado : null;
  return {
    resultado,
    obligatorio: p.obligatorio === true,
    fechaAplicacion: textoONulo(p.fecha_aplicacion),
    observaciones: texto(p.observaciones),
    tieneInforme: p.tiene_informe === true,
    informeTamano: numeroONulo(p.informe_tamano),
    registradoPor: textoONulo(p.registrado_por),
    registradoEl: textoONulo(p.registrado_el),
    sugiereRechazo: p.sugiere_rechazo === true,
  };
}

function propuestaDesdeApi(raw: unknown): PropuestaCargo {
  const p = objeto(raw);
  return {
    cargoId: numeroONulo(p.cargo_id),
    cargoEspecificoId: numeroONulo(p.cargo_especifico_id),
    tipoNominaId: numeroONulo(p.tipo_nomina_id),
    direccionGeneralId: numeroONulo(p.direccion_general_id),
    direccionLineaId: numeroONulo(p.direccion_linea_id),
    coordinacionId: numeroONulo(p.coordinacion_id),
    dependenciaId: numeroONulo(p.dependencia_id),
    cargoTexto: texto(p.cargo_texto),
    oficinaTexto: texto(p.oficina_texto),
  };
}

export function detalleDesdeApi(d: Crudo): DetalleExpediente {
  const e = objeto(d.expediente);
  const p = objeto(d.postulante);
  return {
    expediente: {
      id: texto(e.id),
      numero: texto(e.numero),
      estado: texto(e.estado),
      ventana: numeroONulo(e.ventana),
      venceEl: textoONulo(e.vence_el),
      fechaApertura: textoONulo(e.fecha_apertura),
      fechaCierre: textoONulo(e.fecha_cierre),
      observaciones: texto(e.observaciones),
      esReingreso: e.es_reingreso === true,
      propuesta: propuestaDesdeApi(e.propuesta),
    },
    postulante: {
      id: texto(p.id),
      cedula: texto(p.cedula),
      nombres: texto(p.nombres),
      apellidos: texto(p.apellidos),
      correo: texto(p.correo),
      telefonoMovil: texto(p.telefono_movil),
      esReingreso: p.es_reingreso === true,
    },
    datosVentana1: objeto(d.datos_ventana1),
    historial: lista(d.historial).map(hitoDesdeApi),
    psicofisico: psicofisicoDesdeApi(d.psicofisico),
    acciones: lista(d.acciones).map(accionDesdeApi),
  };
}

export function credencialDesdeApi(raw: unknown): CredencialEmitida {
  const c = objeto(raw);
  return {
    usuario: texto(c.usuario),
    claveTemporal: texto(c.clave_temporal),
    ventana: numeroONulo(c.ventana),
    venceEl: textoONulo(c.vence_el),
    debeCambiarClave: c.debe_cambiar_clave !== false,
  };
}

export function altaDesdeApi(d: Crudo, mensaje: string): AltaPostulanteResultado {
  const e = objeto(d.expediente);
  return {
    expedienteId: texto(e.id),
    numero: texto(e.numero),
    esReingreso: d.es_reingreso === true,
    credencial: credencialDesdeApi(d.credencial),
    mensaje,
  };
}
