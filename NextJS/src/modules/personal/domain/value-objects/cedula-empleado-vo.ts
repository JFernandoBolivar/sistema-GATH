/**
 * Value Object cédula de empleado (módulo personal). Valida su invariante en
 * la construcción y es inmutable. Reutiliza el formato compartido `CEDULA`
 * de `@/shared/validation/regex` — cero regex inline (Regla R2).
 */
import { CEDULA, CEDULA_MSG, ERROR } from "@/shared/domain/validation";

export type CedulaEmpleadoVO = {
  readonly value: string;
};

export function crearCedulaEmpleadoVO(valor: string): CedulaEmpleadoVO {
  const normalizado = valor.trim().toUpperCase();
  if (!normalizado) {
    throw new Error(ERROR.REQUIRED);
  }
  if (!CEDULA.test(normalizado)) {
    throw new Error(CEDULA_MSG);
  }
  return { value: normalizado };
}
