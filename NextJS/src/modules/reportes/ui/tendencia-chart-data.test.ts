import { describe, expect, it } from "vitest";

import type { TendenciaPeriodoDTO } from "../application/dtos/reporte-dto";
import { buildTendenciaChartData } from "./tendencia-chart-data";

describe("buildTendenciaChartData", () => {
  it("traduce la serie mensual a los datos que consume la gráfica", () => {
    const serie: TendenciaPeriodoDTO[] = [
      { periodo: "2026-07", ingresos: 0, egresos: 0 },
      { periodo: "2026-08", ingresos: 3, egresos: 1 },
    ];

    const result = buildTendenciaChartData(serie);

    expect(result).toEqual([
      { periodo: "2026-07", Ingresos: 0, Egresos: 0 },
      { periodo: "2026-08", Ingresos: 3, Egresos: 1 },
    ]);
  });

  it("retorna un arreglo vacío cuando no hay datos", () => {
    expect(buildTendenciaChartData([])).toEqual([]);
  });
});
