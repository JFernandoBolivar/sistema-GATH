/**
 * Value Object respuesta de texto del censo (autogestión). Requiere texto
 * no vacío y sin HTML para preservar la regla R2 (cero XSS / cero regex
 * inline).
 */
import { SAFE_TEXT, SAFE_TEXT_MSG, ERROR } from "@/shared/domain/validation";

export type RespuestaTextoCensoVO = {
  readonly value: string;
};

export function crearRespuestaTextoCensoVO(valor: string): RespuestaTextoCensoVO {
  const normalizado = valor.trim();
  if (!normalizado) {
    throw new Error(ERROR.REQUIRED);
  }
  if (!SAFE_TEXT.test(normalizado)) {
    throw new Error(SAFE_TEXT_MSG);
  }
  return { value: normalizado };
}
