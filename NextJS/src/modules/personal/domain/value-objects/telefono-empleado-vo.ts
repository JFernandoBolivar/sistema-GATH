/**
 * Value Object teléfono de empleado (módulo personal). Acepta móvil o fijo
 * venezolano y normaliza a dígitos. Reutiliza los formatos compartidos de
 * `@/shared/validation/regex`.
 */
import { PHONE_VE, PHONE_VE_FIJO, PHONE_VE_MSG, PHONE_VE_FIJO_MSG, ERROR } from "@/shared/domain/validation";

export type TelefonoEmpleadoVO = {
  readonly value: string;
};

export function crearTelefonoEmpleadoVO(valor: string): TelefonoEmpleadoVO {
  const normalizado = valor.trim().replace(/\D/g, "");
  if (!normalizado) {
    throw new Error(ERROR.REQUIRED);
  }
  if (PHONE_VE.test(normalizado)) {
    return { value: normalizado };
  }
  if (PHONE_VE_FIJO.test(normalizado)) {
    return { value: normalizado };
  }
  const msg = PHONE_VE.test(normalizado.slice(0, 4)) ? PHONE_VE_MSG : PHONE_VE_FIJO_MSG;
  throw new Error(msg);
}
