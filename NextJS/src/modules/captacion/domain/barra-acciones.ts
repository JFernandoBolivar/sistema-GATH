import type { AccionExpediente } from "./expediente";

/** Qué hace la interfaz al pulsar la acción (lo decide `requiere_*` del backend, no una regla propia). */
export type ModoAccion = "directa" | "motivo" | "propuesta";

export type VarianteAccion = "primaria" | "secundaria" | "peligro";

export interface ItemBarraAcciones {
  destino: string;
  etiqueta: string;
  modo: ModoAccion;
  variante: VarianteAccion;
  deshabilitada: boolean;
  /** Por qué está bloqueada (tooltip y texto visible bajo el botón). */
  motivoBloqueo: string;
  destacada: boolean;
}

/** Destinos que cierran el expediente: se pintan como acción destructiva (solo presentación). */
const DESTINOS_DE_RECHAZO = /^RECHAZADO_/;

function modoDe(accion: AccionExpediente): ModoAccion {
  if (accion.requierePropuesta) return "propuesta";
  if (accion.requiereMotivo) return "motivo";
  return "directa";
}

/**
 * Construye la barra de acciones SOLO desde `acciones[]`: respeta el orden del servidor, deshabilita las
 * bloqueadas con su motivo y destaca la sugerida. No conoce estados ni permisos.
 */
export function construirBarraAcciones(acciones: readonly AccionExpediente[]): ItemBarraAcciones[] {
  return acciones.map((a) => {
    const peligro = DESTINOS_DE_RECHAZO.test(a.destino);
    return {
      destino: a.destino,
      etiqueta: a.etiqueta,
      modo: modoDe(a),
      variante: peligro ? "peligro" : a.requiereMotivo ? "secundaria" : "primaria",
      deshabilitada: a.bloqueada,
      motivoBloqueo: a.bloqueada ? a.motivoBloqueo : "",
      destacada: a.sugerida,
    };
  });
}
