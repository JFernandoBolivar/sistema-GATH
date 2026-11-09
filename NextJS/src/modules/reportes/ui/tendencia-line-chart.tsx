"use client";

/**
 * Componente de presentación pura: tendencia mensual de ingresos/egresos de
 * personal. Recibe los datos ya derivados por `buildTendenciaChartData`
 * (regla R3: ui/ no reimplementa lógica).
 */
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";

import type { TendenciaLineDatum } from "./tendencia-chart-data";

interface TendenciaLineChartProps {
  data: TendenciaLineDatum[];
}

const CHART_CONFIG: ChartConfig = {
  Ingresos: { label: "Ingresos", color: "var(--chart-1)" },
  Egresos: { label: "Egresos", color: "var(--chart-2)" },
};

export function TendenciaLineChart({ data }: TendenciaLineChartProps) {
  return (
    <ChartContainer config={CHART_CONFIG} className="max-h-72 w-full">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="periodo" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line type="monotone" dataKey="Ingresos" stroke="var(--color-Ingresos)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Egresos" stroke="var(--color-Egresos)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}
