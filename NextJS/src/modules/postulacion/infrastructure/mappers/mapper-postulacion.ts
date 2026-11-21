import type {
  EnvioDTO,
  ExpedienteDTO,
  MiExpedienteDTO,
  SesionInvitadoDTO,
} from "../../application/dtos/postulacion-dto";

type Crudo = Record<string, unknown>;

const texto = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const textoONulo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const objeto = (v: unknown): Crudo =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Crudo) : {};

export function mapearExpediente(crudo: unknown): ExpedienteDTO {
  const e = objeto(crudo);
  const obs = e.ultima_observacion ? objeto(e.ultima_observacion) : null;
  return {
    id: texto(e.id),
    numero: texto(e.numero),
    estado: texto(e.estado),
    ventana: Number(e.ventana ?? 1),
    venceEl: textoONulo(e.vence_el),
    observaciones: texto(e.observaciones),
    fechaApertura: textoONulo(e.fecha_apertura),
    ultimaObservacion: obs ? { motivo: texto(obs.motivo), fecha: textoONulo(obs.fecha) } : null,
  };
}

export function mapearMiExpediente(crudo: unknown): MiExpedienteDTO {
  const d = objeto(crudo);
  const p = objeto(d.postulante);
  return {
    expediente: mapearExpediente(d.expediente),
    postulante: {
      cedula: texto(p.cedula),
      nombres: texto(p.nombres),
      apellidos: texto(p.apellidos),
      correo: texto(p.correo),
      telefonoMovil: texto(p.telefono_movil),
    },
    datosVentana1: objeto(d.datos_ventana1),
    camposPendientes: Array.isArray(d.campos_pendientes) ? d.campos_pendientes.map(texto) : [],
  };
}

export function mapearSesionInvitado(crudo: unknown): SesionInvitadoDTO {
  const d = objeto(crudo);
  const e = objeto(d.expediente);
  return {
    token: texto(d.token),
    scope: texto(d.scope),
    expiraEl: texto(d.expira_el),
    expiraEnSegundos: Number(d.expira_en_segundos ?? 0),
    debeCambiarClave: d.debe_cambiar_clave === true,
    expediente: {
      id: texto(e.id),
      numero: texto(e.numero),
      estado: texto(e.estado),
      ventana: Number(e.ventana ?? 1),
      venceEl: textoONulo(e.vence_el),
    },
  };
}

export function mapearEnvio(crudo: unknown): EnvioDTO {
  const d = objeto(crudo);
  return { sesionCerrada: d.sesion_cerrada === true, expediente: mapearExpediente(d.expediente) };
}
