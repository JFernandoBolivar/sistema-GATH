import type { DecisionEntity, SolicitudEntity } from "../entities/fe-de-vida";
import type { TipoDecision } from "../value-objects/estados";

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

/**
 * Checks vigentes del envío en curso (los retirados no cuentan). Solo para mostrar quién aprobó: qué acciones
 * tiene cada revisor lo decide el servidor (`acciones_disponibles`).
 */
export function checksVigentes(s: Pick<SolicitudEntity, "decisiones" | "envios">): DecisionEntity[] {
  let vigentes: DecisionEntity[] = [];
  for (const d of s.decisiones) {
    if (d.envio !== s.envios) continue;
    if (d.tipo === "CHECK") vigentes.push(d);
    else if (d.tipo === "CHECK_RETIRADO")
      vigentes = vigentes.filter((c) => c.actorCedula !== d.actorCedula);
  }
  return vigentes;
}

/** Primer check vigente del envío en curso (quién lo dio y con qué rol). */
export function primerCheck(s: SolicitudEntity): DecisionEntity | null {
  return checksVigentes(s)[0] ?? null;
}

const ROL_LEGIBLE: Record<string, string> = { ANALISTA: "Analista", ADMINISTRADORA: "Administradora" };

/** «ADMINISTRADORA» → «Administradora»; nunca el código en crudo. */
export function rolLegible(rol: string): string {
  return ROL_LEGIBLE[rol.toUpperCase()] ?? (rol ? rol.charAt(0).toUpperCase() + rol.slice(1).toLowerCase() : "");
}

/** Rol que falta para completar el doble check, dado el rol del primero. */
export function rolQueFalta(rolPrimero: string): string {
  return rolPrimero.toUpperCase() === "ANALISTA" ? ROL_LEGIBLE.ADMINISTRADORA : ROL_LEGIBLE.ANALISTA;
}

/** Años cumplidos a `hoy` (fecha ISO `AAAA-MM-DD`); `null` si la fecha no es válida o es futura. */
export function edadEn(fechaNacimiento: string | null | undefined, hoy: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento ?? "");
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) edad -= 1;
  return edad >= 0 && edad < 150 ? edad : null;
}

/** ¿Hace falta una foto nueva antes de enviar? Siempre que no haya, o la devolución la pidió. */
export function requiereFotoNueva(s: SolicitudEntity): boolean {
  if (!s.tieneEvidencia) return true;
  return s.estado === "DEVUELTA" && s.requiereNuevaFoto;
}

/** Respaldo de los días sugeridos si la configuración del servidor no responde (D11/B5). */
export const DIAS_RECORDATORIO_RESPALDO: readonly number[] = [30, 15, 7, 3, 1];
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

/** Niveles de la estructura organizativa de una asignación (del más general al más específico). */
export interface NivelesEstructura {
  dependencia?: string | null;
  direccion_general?: string | null;
  direccion_linea?: string | null;
  coordinacion?: string | null;
}

/** Valores que el servidor usa para «sin dato» en los niveles de estructura. */
const SIN_NIVEL = new Set(["", "N/A"]);

/**
 * Oficina de adscripción: el nivel más específico que tenga la asignación
 * (coordinación → dirección de línea → dirección general → dependencia).
 */
export function oficinaDeAdscripcion(niveles: NivelesEstructura | undefined): string | null {
  if (!niveles) return null;
  const candidatos = [
    niveles.coordinacion,
    niveles.direccion_linea,
    niveles.direccion_general,
    niveles.dependencia,
  ];
  for (const valor of candidatos) {
    const limpio = valor?.trim() ?? "";
    if (!SIN_NIVEL.has(limpio.toUpperCase())) return limpio;
  }
  return null;
}
