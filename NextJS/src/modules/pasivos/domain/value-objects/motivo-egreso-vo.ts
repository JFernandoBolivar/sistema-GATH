/**
 * Value Object motivo de egreso (módulo pasivos). Valida su invariante en la
 * construcción y es inmutable. Cero regex inline: reutiliza `SAFE_TEXT` del
 * kernel de dominio (R2).
 */
import { ERROR, SAFE_TEXT, SAFE_TEXT_MSG } from "@/shared/domain/validation";

export type MotivoEgresoVO = {
  readonly value: string;
};

export function crearMotivoEgresoVO(valor: string): MotivoEgresoVO {
  const normalizado = valor.trim();
  if (!normalizado) {
    throw new Error(ERROR.REQUIRED);
  }
  if (!SAFE_TEXT.test(normalizado)) {
    throw new Error(SAFE_TEXT_MSG);
  }
  return { value: normalizado };
}
