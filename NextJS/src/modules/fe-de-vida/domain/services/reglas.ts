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

/** «7, 3, 1» → [7, 3, 1] (enteros positivos únicos, de mayor a menor); `null` si hay un valor inválido. */
export function parsearDiasRecordatorio(texto: string): number[] | null {
  const partes = texto
    .split(/[,\s;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const dias: number[] = [];
  for (const p of partes) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n < 1) return null;
    if (!dias.includes(n)) dias.push(n);
  }
  return dias.sort((a, b) => b - a);
}
