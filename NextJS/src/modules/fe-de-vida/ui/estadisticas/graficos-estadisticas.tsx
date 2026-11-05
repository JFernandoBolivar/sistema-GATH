"use client";

/** Gráficos de presentación pura: reciben los datos ya calculados por `datos-graficos.ts`. */
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";

import type { BarraEstado, BarraTipo, DonutCobertura } from "./datos-graficos";

const CONFIG_TIPOS: ChartConfig = {
  respondieron: { label: "Respondieron", color: "var(--chart-1)" },
  faltan: { label: "Faltan por responder", color: "var(--chart-3)" },
};
const CONFIG_ESTADOS: ChartConfig = { total: { label: "Solicitudes", color: "var(--chart-2)" } };
const CONFIG_DONUT: ChartConfig = { value: { label: "Pasivos" } };
const COLORES_DONUT = ["var(--chart-1)", "var(--chart-3)"];

export function GraficoTipos({ datos }: { datos: BarraTipo[] }) {
  if (datos.length === 0) return null;
  return (
    <ChartContainer config={CONFIG_TIPOS} className="max-h-72 w-full">
      <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="respondieron" stackId="cobertura" fill="var(--color-respondieron)" radius={[0, 0, 4, 4]} />
        <Bar dataKey="faltan" stackId="cobertura" fill="var(--color-faltan)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function GraficoEstados({ datos }: { datos: BarraEstado[] }) {
  if (datos.length === 0) return null;
  return (
    <ChartContainer config={CONFIG_ESTADOS} className="max-h-72 w-full">
      <BarChart data={datos} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={128} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function GraficoDonut({ datos, total }: { datos: DonutCobertura[]; total: number }) {
  return (
    <ChartContainer config={CONFIG_DONUT} className="mx-auto aspect-square max-h-64">
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent hideLabel nameKey="name" formatter={(valor, nombre) => [`${valor}`, nombre]} />}
        />
        <Pie data={datos} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} strokeWidth={4}>
          {datos.map((entrada, indice) => (
            <Cell key={entrada.name} fill={COLORES_DONUT[indice % COLORES_DONUT.length]} />
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
                    pasivos
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
