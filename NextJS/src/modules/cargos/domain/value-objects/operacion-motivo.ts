/**
 * Operación que pide un «Motivo». El backend decide la categoría de motivos de
 * cada una (`core/domain/categorias_motivo.py`); aquí solo viaja la clave, nunca el
 * nombre de la categoría ni texto del motivo.
 */
export type OperacionMotivo =
  | "asignar_cargo"
  | "desasignar_cargo"
  | "cambiar_cargo"
  | "cambiar_estatus_puesto"
  | "prestamo_cargo"
  | "pase_a_pasivo"
  | "egreso_activo"
  | "egreso_pasivo"
  | "cambiar_estatus_pasivo";

export const MOTIVO_NOMBRE_MIN = 3;
export const MOTIVO_NOMBRE_MAX = 100;

/** Mensaje de error del nombre de un motivo nuevo, o `null` si es válido (3–100 caracteres, sin repetir). */
export function validarNombreMotivoNuevo(nombre: string, existentes: readonly string[]): string | null {
  const texto = nombre.trim().replace(/\s+/g, " ");
  if (texto.length < MOTIVO_NOMBRE_MIN) return `Escriba al menos ${MOTIVO_NOMBRE_MIN} caracteres.`;
  if (texto.length > MOTIVO_NOMBRE_MAX) return `No puede superar ${MOTIVO_NOMBRE_MAX} caracteres.`;
  if (/[<>]/.test(texto)) return "No puede contener «<» ni «>».";
  const clave = texto.toLocaleUpperCase("es");
  if (existentes.some((e) => e.trim().toLocaleUpperCase("es") === clave)) {
    return "Ya existe un motivo con ese nombre.";
  }
  return null;
}
