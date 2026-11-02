/**
 * Value Object estado de vigencia de un carnet (activo/no activo). Encierra
 * el invariante booleano para evitar "magic booleans" dispersos.
 */
export type EstadoCarnetVO = {
  readonly activo: boolean;
};

export function crearEstadoCarnetVO(activo: boolean): EstadoCarnetVO {
  return { activo: Boolean(activo) };
}
