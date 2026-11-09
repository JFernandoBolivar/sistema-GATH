/**
 * FIX-AUD7: ¿el trabajador tiene una fecha de ingreso que permita calcular el
 * APN? Si no, la ficha muestra «—» en vez de «0 días».
 */
export interface FuenteFechaIngreso {
  fecha_ingreso?: string | null;
}

export function tieneFechaIngresoApn(
  fechaContrato: string | null | undefined,
  antecedentes: ReadonlyArray<FuenteFechaIngreso> | undefined,
): boolean {
  if (fechaContrato) return true;
  return (antecedentes ?? []).some((antecedente) => Boolean(antecedente.fecha_ingreso));
}
