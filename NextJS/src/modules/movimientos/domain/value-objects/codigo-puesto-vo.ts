/**
 * Value Object código de puesto (puesto = código de nómina + denominación).
 * Acepta la forma del legado (ej. "0-00-000000-00") y vacío no permitido,
 * pues se usa como clave de consulta de historial de un cargo.
 */
import { ERROR } from "@/shared/domain/validation";

const PUESTO = /^[0-9A-Za-z-]{3,64}$/;

export type CodigoPuestoVO = {
  readonly value: string;
};

export function crearCodigoPuestoVO(valor: string): CodigoPuestoVO {
  const normalizado = valor.trim().toUpperCase();
  if (!normalizado) {
    throw new Error(ERROR.REQUIRED);
  }
  if (!PUESTO.test(normalizado)) {
    throw new Error("Código de puesto inválido");
  }
  return { value: normalizado };
}
