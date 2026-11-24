/** Tarea «contactar al postulante»: antigüedad en lenguaje claro y señal de atraso. */

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «hace 2 días», «hace 3 horas», «hace unos minutos»; cadena vacía si la fecha no es válida. */
export function antiguedadRelativa(iso: string | null | undefined, ahora: Date): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const ms = Math.max(0, ahora.getTime() - t);
  if (ms < HORA) return ms < MINUTO ? "hace unos segundos" : `hace ${plural(Math.floor(ms / MINUTO), "minuto", "minutos")}`;
  if (ms < DIA) return `hace ${plural(Math.floor(ms / HORA), "hora", "horas")}`;
  return `hace ${plural(Math.floor(ms / DIA), "día", "días")}`;
}

export interface EstadoContacto {
  pendiente: boolean;
  atrasado: boolean;
  /** «hace 2 días» (vacío si no está pendiente). */
  antiguedad: string;
  /** Texto del banner o de la fila. */
  texto: string;
}

export function describirContacto(
  c: { contactoPendiente: boolean; contactoPendienteDesde: string | null; contactoAtrasado: boolean },
  ahora: Date,
): EstadoContacto {
  if (!c.contactoPendiente) return { pendiente: false, atrasado: false, antiguedad: "", texto: "" };
  const antiguedad = antiguedadRelativa(c.contactoPendienteDesde, ahora);
  const base = antiguedad ? `Por contactar desde ${antiguedad.replace(/^hace /, "hace ")}` : "Por contactar";
  return {
    pendiente: true,
    atrasado: c.contactoAtrasado,
    antiguedad,
    texto: c.contactoAtrasado ? `${base}. Ya pasó el plazo: contáctelo cuanto antes.` : `${base}.`,
  };
}
