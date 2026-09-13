import { describe, expect, it } from "vitest";

import type { DistribucionNominaDTO } from "../application/dtos/reporte-dto";
import { buildDistribucionNominaChartData } from "./distribucion-nomina-chart-data";

describe("buildDistribucionNominaChartData", () => {
  it("traduce la distribución por tipo de nómina a los datos que consume la gráfica", () => {
    const serie: DistribucionNominaDTO[] = [
      { tipoNomina: "FIJO", total: 120 },
      { tipoNomina: "CONTRATADO", total: 45 },
    ];

    const result = buildDistribucionNominaChartData(serie);

    expect(result).toEqual([
      { name: "FIJO", value: 120 },
      { name: "CONTRATADO", value: 45 },
    ]);
  });

  it("retorna un arreglo vacío cuando no hay datos", () => {
    expect(buildDistribucionNominaChartData([])).toEqual([]);
  });
});
