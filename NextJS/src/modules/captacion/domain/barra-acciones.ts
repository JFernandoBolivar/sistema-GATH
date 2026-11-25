import { DESTINO_CONTRATADO } from "./contratacion";
import type { AccionExpediente } from "./expediente";
import {
  CODIGO_ADJUNTAR_FIRMADO,
  CODIGO_GENERAR_PUNTO_CUENTA,
  CODIGO_LIBERAR,
  CODIGO_REGISTRAR_APROBACION,
  CODIGO_RESERVAR,
} from "./ingreso-corto";
import { sinJerga } from "./jerga";

/** Qué hace la interfaz al pulsar la acción (lo decide `requiere_*` del backend, no una regla propia). */
export type ModoAccion =
  | "directa"
  | "motivo"
  | "propuesta"
  | "contratacion"
  // Flujo sin Presupuesto y/o sin Dirección General (M-5): cada una abre su propio panel o confirmación.
  | "reservar"
  | "liberar"
  | "generar_punto_cuenta"
  | "aprobacion"
  | "adjuntar_firmado";

export type VarianteAccion = "primaria" | "secundaria" | "peligro";

export interface ItemBarraAcciones {
  /** Identifica la acción en la lista (el destino puede venir vacío en las acciones por código). */
  clave: string;
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

const MODO_POR_CODIGO: Record<string, ModoAccion> = {
  [CODIGO_RESERVAR]: "reservar",
  [CODIGO_LIBERAR]: "liberar",
  [CODIGO_GENERAR_PUNTO_CUENTA]: "generar_punto_cuenta",
  [CODIGO_REGISTRAR_APROBACION]: "aprobacion",
  [CODIGO_ADJUNTAR_FIRMADO]: "adjuntar_firmado",
};

function modoDe(accion: AccionExpediente): ModoAccion {
  // Las acciones del flujo corto traen su `codigo` (el destino puede ir vacío): mandan sobre el resto.
  const porCodigo = accion.codigo ? MODO_POR_CODIGO[accion.codigo] : undefined;
  if (porCodigo) return porCodigo;
  // Contratar ya no es una transición: tiene su propia ruta atómica (`asignar/`) y su propia confirmación.
  if (accion.destino === DESTINO_CONTRATADO) return "contratacion";
  if (accion.requierePropuesta) return "propuesta";
  if (accion.requiereMotivo) return "motivo";
  return "directa";
}

/**
 * Construye la barra de acciones SOLO desde `acciones[]`: respeta el orden del servidor, deshabilita las
 * bloqueadas con su motivo y destaca la sugerida. No conoce estados ni permisos.
 */
export function construirBarraAcciones(acciones: readonly AccionExpediente[]): ItemBarraAcciones[] {
  const items = acciones.map((a): ItemBarraAcciones => {
    const peligro = DESTINOS_DE_RECHAZO.test(a.destino);
    const contratar = a.destino === DESTINO_CONTRATADO;
    return {
      clave: a.codigo || a.destino,
      destino: a.destino,
      etiqueta: contratar ? "Contratar y asignar puesto" : sinJerga(a.etiqueta),
      modo: modoDe(a),
      variante: peligro ? "peligro" : a.requiereMotivo && !contratar ? "secundaria" : "primaria",
      deshabilitada: a.bloqueada,
      motivoBloqueo: a.bloqueada ? sinJerga(a.motivoBloqueo) : "",
      destacada: a.sugerida,
    };
  });
  // Liberar siempre queda en segundo plano; reservar o cambiar el puesto también cuando ya se puede dar el paso siguiente.
  const haySiguiente = items.some(
    (i) => (i.modo === "generar_punto_cuenta" || i.modo === "aprobacion" || i.modo === "adjuntar_firmado") && !i.deshabilitada,
  );
  return items.map((i) =>
    i.modo === "liberar" || (haySiguiente && i.modo === "reservar") ? { ...i, variante: "secundaria" as const } : i,
  );
}
