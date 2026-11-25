import type {
  AccionExpediente,
  AltaPostulanteResultado,
  CredencialEmitida,
  EnlaceActivacionInfo,
  DetalleExpediente,
  FaltanteVentana2,
  FilaBandeja,
  HitoHistorial,
  PaginaBandeja,
  PropuestaCargo,
  ResultadoPsicofisico,
  ResultadoTransicion,
} from "../../domain/expediente";
import type { ResultadoContratacion } from "../../domain/contratacion";

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
    contactoPendiente: f.contacto_pendiente === true,
    contactoPendienteDesde: textoONulo(f.contacto_pendiente_desde),
    contactoAtrasado: f.contacto_atrasado === true,
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
    actorNombre: textoONulo(h.actor_nombre),
    motivo: texto(h.motivo),
    tipo: textoONulo(h.tipo),
    correoEnmascarado: textoONulo(h.correo_enmascarado),
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
  const foto = objeto(d.foto);
  return {
    expediente: {
      contactoPendiente: e.contacto_pendiente === true,
      contactoPendienteDesde: textoONulo(e.contacto_pendiente_desde),
      contactoAtrasado: e.contacto_atrasado === true,
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
    datosVentana2: objeto(d.datos_ventana2),
    datosVentana2Legible: d.datos_ventana2_legible && typeof d.datos_ventana2_legible === "object" ? objeto(d.datos_ventana2_legible) : null,
    ventana2Faltantes: Array.isArray(d.ventana2_faltantes)
      ? d.ventana2_faltantes.map((x): FaltanteVentana2 => {
          const o = objeto(x);
          return { seccion: texto(o.seccion), campo: texto(o.campo), mensaje: texto(o.mensaje) };
        })
      : null,
    foto: {
      tiene: foto.tiene === true,
      subidaEl: textoONulo(foto.subida_el),
      tamano: numeroONulo(foto.tamano),
      url: textoONulo(foto.url),
    },
    enlaceActivacion: enlaceActivacionDesdeApi(d.enlace_activacion),
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
    enlace: c.enlace && typeof c.enlace === "object"
      ? { enviadoA: texto(objeto(c.enlace).enviado_a), venceEl: textoONulo(objeto(c.enlace).vence_el) }
      : null,
  };
}

const ESTADOS_ENLACE = new Set(["PENDIENTE", "USADO", "VENCIDO", "ANULADO", "BLOQUEADO"]);

export function enlaceActivacionDesdeApi(raw: unknown): EnlaceActivacionInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const e = objeto(raw);
  const estado = texto(e.estado);
  if (!ESTADOS_ENLACE.has(estado)) return null;
  return {
    estado: estado as EnlaceActivacionInfo["estado"],
    enviadoA: texto(e.enviado_a),
    enviadoEl: textoONulo(e.enviado_el),
    venceEl: textoONulo(e.vence_el),
    usadoEl: textoONulo(e.usado_el),
  };
}

/** Respuesta de `enviar-enlace/`: se presenta como una credencial sin contraseña para reusar el mismo panel. */
export function envioEnlaceDesdeApi(raw: unknown): CredencialEmitida {
  const e = objeto(raw);
  return {
    usuario: "",
    claveTemporal: "",
    ventana: null,
    venceEl: textoONulo(e.vence_el),
    debeCambiarClave: false,
    enlace: { enviadoA: texto(e.enviado_a), venceEl: textoONulo(e.vence_el) },
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

/** Respuesta de `transicion/`: el detalle y, al reabrir la Ventana 2 u observar faltantes, la credencial nueva. */
export function transicionDesdeApi(d: Crudo): ResultadoTransicion {
  return { detalle: detalleDesdeApi(d), credencial: d.credencial ? credencialDesdeApi(d.credencial) : null };
}

export function contratacionDesdeApi(d: Crudo): ResultadoContratacion {
  const p = objeto(d.puesto);
  const c = objeto(d.cuenta);
  return {
    employeeId: texto(d.employee_id) || String(d.employee_id ?? ""),
    cedula: texto(d.cedula),
    esReingreso: d.es_reingreso === true,
    puesto: { id: String(p.id ?? ""), codigo: texto(p.codigo) },
    familiaresCopiados: numeroONulo(d.familiares_copiados) ?? 0,
    cuenta: {
      creada: c.creada === true,
      reactivada: c.reactivada === true,
      motivo: texto(c.motivo),
      correo: textoONulo(c.correo),
      correoAlternativo: textoONulo(c.correo_alternativo),
      diasVigenciaClaveInicial: numeroONulo(c.dias_vigencia_clave_inicial),
      entrega: textoONulo(c.entrega),
    },
  };
}
