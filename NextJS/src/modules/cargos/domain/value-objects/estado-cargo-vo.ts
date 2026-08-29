/**
 * Value Object estado de una asignación de cargo: es activo o es vacante,
 * nunca ambos, nunca ninguno (invariante mutuamente excluyente).
 */
export type EstadoCargoVO = {
  readonly activo: boolean;
  readonly estaVacante: boolean;
};

export function crearEstadoCargoVO(activo: boolean, estaVacante: boolean): EstadoCargoVO {
  if (activo && estaVacante) {
    throw new Error("Un cargo no puede ser activo y vacante a la vez");
  }
  if (!activo && !estaVacante) {
    throw new Error("Un cargo debe ser activo o vacante");
  }
  return { activo, estaVacante };
}
