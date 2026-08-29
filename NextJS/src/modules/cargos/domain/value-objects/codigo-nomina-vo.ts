/**
 * Value Object código de nómina de una asignación de cargo. Formato alineado
 * al legado: prefijo textual (ej. "ASIG-") seguido de dígitos; acepta vacío
 * cuando no hay código asignado (vacantes).
 */
import { ERROR } from "@/shared/domain/validation";

export type CodigoNominaVO = {
  readonly value: string | null;
};

export function crearCodigoNominaVO(valor: string | null | undefined): CodigoNominaVO {
  if (valor === null || valor === undefined) {
    return { value: null };
  }
  const normalizado = valor.trim().toUpperCase();
  if (!normalizado) {
    return { value: null };
  }
  return { value: normalizado };
}

export function codigoNominaEsValido(valor: string | null | undefined): boolean {
  try {
    crearCodigoNominaVO(valor);
    return true;
  } catch {
    return false;
  }
}
