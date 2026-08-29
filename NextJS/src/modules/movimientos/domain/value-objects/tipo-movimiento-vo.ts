/**
 * Value Object tipo de movimiento de cargo. Conjunto cerrado alineado al
 * negocio del legado: transferencia, ascenso, movimiento horizontal, etc.
 * Evita "string literals" dispersos en consultas de historial.
 */
const TIPOS = [
  "Transferencia",
  "Ascenso",
  "Movimiento Horizontal",
  "Reasignación",
  "Cargo Especial",
  "Préstamo",
  "Egreso a Pasivo",
] as const;

export type TipoMovimientoVO = (typeof TIPOS)[number];

export function crearTipoMovimientoVO(valor: string): TipoMovimientoVO {
  const normalizado = valor.trim();
  if (!(TIPOS as readonly string[]).includes(normalizado)) {
    throw new Error(`Tipo de movimiento inválido: ${valor}`);
  }
  return normalizado as TipoMovimientoVO;
}
