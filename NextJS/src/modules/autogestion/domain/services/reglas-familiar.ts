import { calcularEdadExacta } from "@/shared/lib/formato-fecha";

/** Edad mínima que separa al hijo(a) que aún no tiene cédula del que ya debe tenerla. */
export const EDAD_MINIMA_CEDULA_FAMILIAR = 9;

/** ¿El parentesco elegido es «hijo(a)»? Se compara por nombre del catálogo, no por un id fijo. */
export function esParentescoHijo(parentescoNombre: string | null | undefined): boolean {
  const nombre = (parentescoNombre ?? "").trim().toUpperCase();
  return nombre.includes("HIJO") || nombre.includes("HIJA");
}

/**
 * Regla del registro de familiares: un(a) hijo(a) menor de 9 años puede quedar sin cédula
 * (el servidor genera `<cédula del titular>-<orden>`); en cualquier otro caso la cédula es
 * obligatoria.
 */
export function esHijoMenorSinCedula(
  parentescoNombre: string | null | undefined,
  fechaNacimiento: string | null | undefined,
): boolean {
  if (!esParentescoHijo(parentescoNombre)) return false;
  const edad = calcularEdadExacta(fechaNacimiento);
  return edad !== null && edad < EDAD_MINIMA_CEDULA_FAMILIAR;
}

/** ¿Se muestra la cédula en el formulario? Solo se oculta en el caso del hijo(a) menor de 9. */
export function mostrarCedulaFamiliar(
  parentescoNombre: string | null | undefined,
  fechaNacimiento: string | null | undefined,
): boolean {
  return !esHijoMenorSinCedula(parentescoNombre, fechaNacimiento);
}
