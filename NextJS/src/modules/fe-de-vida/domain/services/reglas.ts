import type { DecisionEntity, SolicitudEntity } from "../entities/fe-de-vida";
import { PERMISOS_FE_DE_VIDA, type TipoDecision } from "../value-objects/estados";

const ESTADOS_REVISABLES = ["PENDIENTE_REVISION", "PENDIENTE_SEGUNDO_CHECK"] as const;

export function esRevisable(s: Pick<SolicitudEntity, "estado">): boolean {
  return (ESTADOS_REVISABLES as readonly string[]).includes(s.estado);
}

/** El pasivo puede llenar o corregir la solicitud (borrador o devuelta). */
export function esEditablePorPasivo(s: Pick<SolicitudEntity, "estado">): boolean {
  return s.estado === "BORRADOR" || s.estado === "DEVUELTA";
}

export function ultimaDecision(
  s: Pick<SolicitudEntity, "decisiones">,
  tipos: readonly TipoDecision[],
): DecisionEntity | null {
  const filtradas = s.decisiones.filter((d) => tipos.includes(d.tipo));
  return filtradas.length > 0 ? filtradas[filtradas.length - 1] : null;
}

/** Motivo que se muestra al pasivo: devolución o rechazo; vacío en los demás estados. */
export function motivoDeEstado(s: SolicitudEntity): string {
  if (s.estado === "DEVUELTA") return ultimaDecision(s, ["DEVOLUCION"])?.motivo ?? "";
  if (s.estado === "RECHAZADA") return ultimaDecision(s, ["RECHAZO"])?.motivo ?? "";
  return "";
}

/** Primer check del envío en curso (quién lo dio y con qué rol). */
export function primerCheck(s: SolicitudEntity): DecisionEntity | null {
  return s.decisiones.find((d) => d.tipo === "CHECK" && d.envio === s.envios) ?? null;
}

/** ¿Hace falta una foto nueva antes de enviar? Siempre que no haya, o la devolución la pidió. */
export function requiereFotoNueva(s: SolicitudEntity): boolean {
  if (!s.tieneEvidencia) return true;
  return s.estado === "DEVUELTA" && s.requiereNuevaFoto;
}

export interface AccionesRevision {
  check: boolean;
  aprobarDirecto: boolean;
  devolver: boolean;
  rechazar: boolean;
}

const tiene = (permisos: readonly string[] | null | undefined, codigo: string) =>
  !!permisos?.includes(codigo);

/**
 * Botones de la revisión según el permiso por código y el estado. El segundo check lo da el
 * OTRO rol y otra persona (el backend lo vuelve a validar).
 */
export function accionesDisponibles(
  s: SolicitudEntity,
  permisos: readonly string[] | null | undefined,
  cedulaActor?: string | null,
): AccionesRevision {
  if (!esRevisable(s)) return { check: false, aprobarDirecto: false, devolver: false, rechazar: false };
  const esAnalista = tiene(permisos, PERMISOS_FE_DE_VIDA.checkAnalista);
  const esAdmin = tiene(permisos, PERMISOS_FE_DE_VIDA.checkAdministradora);
  let check = esAnalista || esAdmin;
  if (s.estado === "PENDIENTE_SEGUNDO_CHECK") {
    const primero = primerCheck(s);
    if (primero) {
      const rolPrimero = primero.rol.toUpperCase();
      check = rolPrimero === "ANALISTA" ? esAdmin : esAnalista;
      if (cedulaActor && primero.actorCedula === cedulaActor) check = false;
    }
  }
  const revisa = tiene(permisos, PERMISOS_FE_DE_VIDA.revisar);
  return {
    check,
    aprobarDirecto: tiene(permisos, PERMISOS_FE_DE_VIDA.aprobarDirecto),
    devolver: revisa,
    rechazar: revisa,
  };
}

/** Días sugeridos para los recordatorios previos al cierre (de mayor a menor). */
export const DIAS_RECORDATORIO_SUGERIDOS: readonly number[] = [30, 15, 7, 3, 1];
/** Mismo tope que el servidor (`MAX_DIAS_RECORDATORIO` del dominio de procesos). */
export const MAX_DIAS_RECORDATORIO = 365;

/** Enteros válidos (1..MAX), sin repetir y de mayor a menor. */
export function normalizarDiasRecordatorio(dias: readonly number[]): number[] {
  return [...new Set(dias)]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_DIAS_RECORDATORIO)
    .sort((a, b) => b - a);
}

/** 1 → «1 día antes»; 7 → «7 días antes». */
export function describirDiaRecordatorio(dias: number): string {
  return `${dias} ${dias === 1 ? "día" : "días"} antes`;
}
