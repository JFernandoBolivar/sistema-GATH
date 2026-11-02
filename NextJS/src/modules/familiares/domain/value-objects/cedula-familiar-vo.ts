/**
 * Value Object cédula de familiar (módulo familiares). Valida su invariante
 * en la construcción y es inmutable. Reutiliza `CEDULA` de
 * `@/shared/validation/regex` — cero regex inline (Regla R2).
 */
import { CEDULA, CEDULA_MSG, ERROR } from "@/shared/domain/validation";

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
