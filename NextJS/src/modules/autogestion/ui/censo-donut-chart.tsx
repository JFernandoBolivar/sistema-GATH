"use client";

/**
 * Componente de presentación pura: dibuja el donut de progreso del censo.
 * No calcula nada de negocio, solo recibe los datos ya derivados por
 * `buildCensoMetricasChartData` (regla R3: ui/ no reimplementa lógica).
 */
import { Cell, Label, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";

import type { CensoDonutDatum } from "./censo-metricas-chart-data";

interface CensoDonutChartProps {
  data: CensoDonutDatum[];
  total: number;
}

const CHART_CONFIG: ChartConfig = {
  value: { label: "Porcentaje" },
};

const COLORS = ["var(--chart-1)", "var(--chart-2)"];

export function CensoDonutChart({ data, total }: CensoDonutChartProps) {
  return (
    <ChartContainer config={CHART_CONFIG} className="mx-auto aspect-square max-h-64">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              nameKey="name"
              formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
            />
          }
        />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} strokeWidth={4}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
              const { cx, cy } = viewBox;
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                  <tspan x={cx} y={cy} className="fill-foreground text-2xl font-bold">
                    {total}
                  </tspan>
                  <tspan x={cx} y={(cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                    empleados
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
