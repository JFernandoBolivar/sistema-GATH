/**
 * Value Object cédula de familiar (módulo familiares). Valida su invariante
 * en la construcción y es inmutable. Reutiliza `CEDULA` de
 * `@/shared/validation/regex` — cero regex inline (Regla R2).
 */
import { CEDULA, CEDULA_MSG, ERROR } from "@/shared/domain/validation";

/** Longitud máxima de la cédula del familiar en la BD (incluye la sintética). */
export const CEDULA_FAMILIAR_MAX = 10;

/** Tope de hijos sin cédula por titular (regla del negocio). */
export const ORDEN_HIJO_TOPE = 27;

/**
 * Mayor orden de nacimiento que cabe en la cédula sintética `<titular>-<orden>`.
 * Los caracteres que sobran son DÍGITOS del orden: con 1 libre caben del 1 al 9.
 */
export function maxOrdenHijo(cedulaTitular: string | null | undefined): number {
  const libres = CEDULA_FAMILIAR_MAX - String(cedulaTitular ?? "").length - 1;
  if (!cedulaTitular || libres <= 0) return 0;
  return Math.min(ORDEN_HIJO_TOPE, 10 ** libres - 1);
}

export type CedulaFamiliarVO = {
  readonly value: string;
};

export function crearCedulaFamiliarVO(valor: string): CedulaFamiliarVO {
  const normalizado = valor.trim().toUpperCase();
  if (!normalizado) {
    throw new Error(ERROR.REQUIRED);
  }
  if (!CEDULA.test(normalizado)) {
    throw new Error(CEDULA_MSG);
  }
  return { value: normalizado };
}
