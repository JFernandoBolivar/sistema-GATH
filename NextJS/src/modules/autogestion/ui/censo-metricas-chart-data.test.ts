import { describe, expect, it } from "vitest";

import type { MetricasCensoDTO } from "../application/dtos/censo-dto";
import { buildCensoMetricasChartData } from "./censo-metricas-chart-data";

function metricas(porDependencia: MetricasCensoDTO["porDependencia"], totalEmpleadosCensados: number): MetricasCensoDTO {
  return {
    totalEmpleadosCensados,
    totalRespuestas: 0,
    porDependencia,
  };
}

describe("buildCensoMetricasChartData", () => {
  it("calcula porcentajes del donut y series de barras por dependencia", () => {
    const dto = metricas(
      [
        { dependenciaId: 1, dependencia: "Talento Humano", totalEmpleados: 10, empleadosCensados: 8 },
        { dependenciaId: 2, dependencia: "Finanzas", totalEmpleados: 5, empleadosCensados: 2 },
      ],
      10,
    );

    const result = buildCensoMetricasChartData(dto);

    expect(result.donutTotal).toBe(15);
    expect(result.respondido).toBe(10);
    expect(result.noRespondido).toBe(5);
    expect(result.donutData).toEqual([
      { name: "Respondido", value: (10 / 15) * 100 },
      { name: "No Respondido", value: (5 / 15) * 100 },
    ]);
    expect(result.barData).toEqual([
      { key: "Talento Humano", metric1: 8, metric2: 2 },
      { key: "Finanzas", metric1: 2, metric2: 3 },
    ]);
  });

  it("no divide por cero cuando no hay empleados registrados", () => {
    const dto = metricas([], 0);

    const result = buildCensoMetricasChartData(dto);

    expect(result.donutTotal).toBe(0);
    expect(result.donutData).toEqual([
      { name: "Respondido", value: 0 },
      { name: "No Respondido", value: 0 },
    ]);
    expect(result.barData).toEqual([]);
  });
});
