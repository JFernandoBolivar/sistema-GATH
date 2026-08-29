/**
 * Value Object código de catálogo/referencia geográfica. Identificador mnemónico
 * corto en minúsculas con guiones (ej. "estado", "municipio"), sin espacios.
 */
import { ERROR } from "@/shared/domain/validation";

const CODIGO = /^[a-z0-9-]{1,64}$/;

export type CodigoCatalogoVO = {
  readonly value: string;
};

export function crearCodigoCatalogoVO(valor: string): CodigoCatalogoVO {
  const normalizado = valor.trim().toLowerCase();
  if (!normalizado) {
    throw new Error(ERROR.REQUIRED);
  }
  if (!CODIGO.test(normalizado)) {
    throw new Error("Código inválido: solo minúsculas, dígitos y guiones");
  }
  return { value: normalizado };
}
