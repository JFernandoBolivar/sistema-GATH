/**
 * Value Object cédula venezolana (paso 1 del checklist §II.8). Valida su
 * invariante en la construcción y es inmutable. Cero regex inline: usa el
 * formato compartido `CEDULA` de `@/shared/validation/regex`.
 */
import { CEDULA, CEDULA_MSG, ERROR } from "@/shared/domain/validation";

export type CedulaVO = {
  readonly value: string;
};

/** Construye una CedulaVO válida (formato V/E/J/P/G + 6 a 9 dígitos). */
export function crearCedulaVO(valor: string): CedulaVO {
  const normalizado = valor.trim().toUpperCase();
  if (!normalizado) {
    throw new Error(ERROR.REQUIRED);
  }
  if (!CEDULA.test(normalizado)) {
    throw new Error(CEDULA_MSG);
  }
  return { value: normalizado };
}
