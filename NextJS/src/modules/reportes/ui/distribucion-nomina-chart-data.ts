/**
 * Deriva los datos de la gráfica de distribución por tipo de nómina a partir
 * del DTO ya calculado por la Server Action. Puro (sin React), para que el
 * componente de gráfica (capa ui/) sea de presentación pura (regla R3).
 */
import type { DistribucionNominaDTO } from "../application/dtos/reporte-dto";

export interface DistribucionNominaDatum {
  name: string;
  value: number;
}

export function buildDistribucionNominaChartData(
  serie: DistribucionNominaDTO[],
): DistribucionNominaDatum[] {
  return serie.map((item) => ({
    name: item.tipoNomina,
    value: item.total,
  }));
}
