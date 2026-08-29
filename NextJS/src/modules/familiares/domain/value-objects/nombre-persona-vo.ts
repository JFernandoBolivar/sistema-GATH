/**
 * Value Object nombre de persona (segundo/pimer nombre, apellidos) para
 * cargas familiares. Reutiliza `NAME` de `@/shared/validation/regex`.
 */
import { NAME, NAME_MSG, ERROR } from "@/shared/domain/validation";

export type NombrePersonaVO = {
  readonly value: string;
};

export function crearNombrePersonaVO(valor: string): NombrePersonaVO {
  const normalizado = valor.trim();
  if (!normalizado) {
    throw new Error(ERROR.REQUIRED);
  }
  if (!NAME.test(normalizado)) {
    throw new Error(NAME_MSG);
  }
  return { value: normalizado };
}
