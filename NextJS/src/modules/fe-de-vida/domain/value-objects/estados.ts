/** Estados y permisos por código de la fe de vida (espejo del backend `apps/fe_de_vida`). */

export const ESTADOS_SOLICITUD = [
  "BORRADOR",
  "PENDIENTE_REVISION",
  "PENDIENTE_SEGUNDO_CHECK",
  "VALIDADA",
  "RECHAZADA",
  "DEVUELTA",
  "EXPIRADA",
  "ARCHIVADA",
] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ESTADOS_PROCESO = ["BORRADOR", "ABIERTO", "CERRADO"] as const;
export type EstadoProceso = (typeof ESTADOS_PROCESO)[number];

export type TipoDecision = "CHECK" | "APROBACION_DIRECTA" | "RECHAZO" | "DEVOLUCION";
export type OrigenEvidencia = "CAMARA" | "ARCHIVO";

export function esEstadoSolicitud(v: string): v is EstadoSolicitud {
  return (ESTADOS_SOLICITUD as readonly string[]).includes(v);
}

export function esEstadoProceso(v: string): v is EstadoProceso {
  return (ESTADOS_PROCESO as readonly string[]).includes(v);
}

/** Permisos por código (nunca por nombre de rol). */
export const PERMISOS_FE_DE_VIDA = {
  solicitar: "fe_de_vida.solicitar",
  verPropia: "fe_de_vida.ver_propia",
  revisar: "fe_de_vida.revisar",
  checkAnalista: "fe_de_vida.check_analista",
  checkAdministradora: "fe_de_vida.check_administradora",
  aprobarDirecto: "fe_de_vida.aprobar_directo",
  verEvidencia: "fe_de_vida.ver_evidencia",
  verPanel: "fe_de_vida.ver_panel",
  gestionarProcesos: "fe_de_vida.gestionar_procesos",
  prorrogar: "fe_de_vida.prorrogar",
  verCobertura: "fe_de_vida.ver_cobertura",
  verificarConstancia: "fe_de_vida.verificar_constancia",
} as const;

export const LIMITE_PAGINA = 10;
export const LIMITE_MAXIMO_PAGINA = 50;
export const MAX_LONGITUD_MOTIVO = 500;
