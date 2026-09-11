/**
 * Deriva los datos de las gráficas de la pestaña Métricas a partir del DTO
 * ya calculado por la Server Action. Puro (sin React), para que los
 * componentes de gráfica (capa ui/) sean de presentación pura.
 */
import type { MetricasCensoDTO } from "../application/dtos/censo-dto";

export interface CensoDonutDatum {
  name: string;
  value: number;
}

export interface CensoBarDatum {
  key: string;
  metric1: number;
  metric2: number;
}

export interface CensoMetricasChartData {
  donutData: CensoDonutDatum[];
  donutTotal: number;
  respondido: number;
  noRespondido: number;
  barData: CensoBarDatum[];
}

export function buildCensoMetricasChartData(metricas: MetricasCensoDTO): CensoMetricasChartData {
  const totalEmpleados = metricas.porDependencia.reduce((acc, d) => acc + d.totalEmpleados, 0);
  const respondido = metricas.totalEmpleadosCensados;
  const noRespondido = Math.max(totalEmpleados - respondido, 0);

  const donutData: CensoDonutDatum[] = [
    { name: "Respondido", value: totalEmpleados > 0 ? (respondido / totalEmpleados) * 100 : 0 },
    { name: "No Respondido", value: totalEmpleados > 0 ? (noRespondido / totalEmpleados) * 100 : 0 },
  ];

  const barData: CensoBarDatum[] = metricas.porDependencia.map((d) => ({
    key: d.dependencia,
    metric1: d.empleadosCensados,
    metric2: Math.max(d.totalEmpleados - d.empleadosCensados, 0),
  }));

  return { donutData, donutTotal: totalEmpleados, respondido, noRespondido, barData };
}
