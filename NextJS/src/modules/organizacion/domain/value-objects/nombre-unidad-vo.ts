/**
 * Value Object nombre de unidad organizacional (dependencia, dirección
 * general, dirección de línea, coordinación, organismo adscrito). Nombre
 * sanitizado y de longitud acotada.
 */
import { NAME, NAME_MSG, ERROR } from "@/shared/domain/validation";

export type NombreUnidadVO = {
  readonly value: string;
};

export function crearNombreUnidadVO(valor: string): NombreUnidadVO {
  const normalizado = valor.trim();
  if (!normalizado) {
    throw new Error(ERROR.REQUIRED);
  }
  if (!NAME.test(normalizado)) {
    throw new Error(NAME_MSG);
  }
  return { value: normalizado };
}
