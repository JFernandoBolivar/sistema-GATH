import type { AccionExpediente } from "./expediente";
import { sinJerga } from "./jerga";

export type PestanaDetalle = "datos" | "ventana2" | "foto" | "documentos" | "psicofisico" | "historial";

export interface BloqueoVisible {
  accion: string;
  causa: string;
  /** Pestaña del expediente donde se resuelve (si se reconoce la causa). */
  pestana: PestanaDetalle | null;
  etiquetaPestana: string | null;
}

const ETIQUETA_PESTANA: Record<PestanaDetalle, string> = {
  datos: "Datos",
  ventana2: "Datos complementarios",
  foto: "Foto",
  documentos: "Documentos",
  psicofisico: "Psicofísico",
  historial: "Historial",
};

/** Pestaña que resuelve una causa de bloqueo, según su texto (solo presentación: el bloqueo lo decide el backend). */
export function pestanaDeBloqueo(causa: string): PestanaDetalle | null {
  const t = causa.toLowerCase();
  if (/psicof/.test(t)) return "psicofisico";
  if (/foto/.test(t)) return "foto";
  if (/documento|firma/.test(t)) return "documentos";
  if (/complementari|ventana\s*2|faltant/.test(t)) return "ventana2";
  return null;
}

/** Causas distintas de las acciones bloqueadas, para mostrarlas en un aviso con enlace a la pestaña. */
export function bloqueosVisibles(acciones: readonly AccionExpediente[]): BloqueoVisible[] {
  const vistos = new Set<string>();
  const salida: BloqueoVisible[] = [];
  for (const a of acciones) {
    if (!a.bloqueada || !a.motivoBloqueo) continue;
    const causa = sinJerga(a.motivoBloqueo);
    if (vistos.has(causa)) continue;
    vistos.add(causa);
    const pestana = pestanaDeBloqueo(a.motivoBloqueo);
    salida.push({ accion: sinJerga(a.etiqueta), causa, pestana, etiquetaPestana: pestana ? ETIQUETA_PESTANA[pestana] : null });
  }
  return salida;
}
