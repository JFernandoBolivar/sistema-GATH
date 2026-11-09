/**
 * Deriva los datos de la gráfica de tendencia a partir del DTO ya calculado
 * por la Server Action. Puro (sin React), para que el componente de gráfica
 * (capa ui/) sea de presentación pura (regla R3).
 */
import type { TendenciaPeriodoDTO } from "../application/dtos/reporte-dto";

export interface TendenciaLineDatum {
  periodo: string;
  Ingresos: number;
  Egresos: number;
}

export function buildTendenciaChartData(serie: TendenciaPeriodoDTO[]): TendenciaLineDatum[] {
  return serie.map((item) => ({
    periodo: item.periodo,
    Ingresos: item.ingresos,
    Egresos: item.egresos,
  }));
}
