"use client";

/**
 * Componente de presentación pura: barras apiladas de respondidos/no
 * respondidos por dependencia. Recibe los datos ya derivados por
 * `buildCensoMetricasChartData` (regla R3: ui/ no reimplementa lógica).
 */
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";

import type { CensoBarDatum } from "./censo-metricas-chart-data";

interface CensoBarrasChartProps {
  data: CensoBarDatum[];
}

const CHART_CONFIG: ChartConfig = {
  metric1: { label: "Respondido", color: "var(--chart-1)" },
  metric2: { label: "No Respondido", color: "var(--chart-2)" },
};

export function CensoBarrasChart({ data }: CensoBarrasChartProps) {
  return (
    <ChartContainer config={CHART_CONFIG} className="max-h-72 w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="key"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="metric1" stackId="censo" fill="var(--color-metric1)" radius={[0, 0, 4, 4]} />
        <Bar dataKey="metric2" stackId="censo" fill="var(--color-metric2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
