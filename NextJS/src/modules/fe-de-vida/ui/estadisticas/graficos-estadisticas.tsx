"use client";

/** Gráficos de presentación pura: reciben los datos ya calculados por `datos-graficos.ts`. */
import type { Ref } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Legend,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/shared/ui/components/chart";

import type { BarraEstado, BarraTipo, DonutCobertura } from "./datos-graficos";
import { COLORES_COBERTURA, PALETA_GRAFICOS, SERIES_GRAFICOS } from "./paleta-graficos";

const CONFIG_TIPOS: ChartConfig = {
  respondieron: { label: "Respondieron", color: SERIES_GRAFICOS[0] },
  faltan: { label: "Faltan", color: SERIES_GRAFICOS[1] },
};
const CONFIG_ESTADOS: ChartConfig = {
  total: { label: "Solicitudes", color: PALETA_GRAFICOS.azulConatel },
};
const CONFIG_DONUT: ChartConfig = { value: { label: "Pasivos" } };

const TIPOGRAFIA = {
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: 12,
};

interface PropsGrafico {
  contenedorRef?: Ref<HTMLDivElement>;
}

export function GraficoTipos({ datos, contenedorRef }: PropsGrafico & { datos: BarraTipo[] }) {
  if (datos.length === 0) return null;
  return (
    <ChartContainer ref={contenedorRef} config={CONFIG_TIPOS} className="max-h-72 w-full font-sans">
      <BarChart data={datos} margin={{ top: 24, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke={PALETA_GRAFICOS.grisBorde} strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={68}
          tickMargin={8}
          tick={{ ...TIPOGRAFIA, fontSize: 11 }}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={TIPOGRAFIA} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend wrapperStyle={TIPOGRAFIA} />
        <Bar dataKey="respondieron" stackId="cobertura" fill="var(--color-respondieron)" radius={[0, 0, 6, 6]} minPointSize={2}>
          <LabelList dataKey="respondieron" position="inside" fill={PALETA_GRAFICOS.blanco} fontSize={11} fontWeight={600} />
        </Bar>
        <Bar dataKey="faltan" stackId="cobertura" fill="var(--color-faltan)" radius={[6, 6, 0, 0]} minPointSize={2}>
          <LabelList dataKey="faltan" position="inside" fill={PALETA_GRAFICOS.azulOscuro} fontSize={11} fontWeight={600} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function GraficoEstados({ datos, contenedorRef }: PropsGrafico & { datos: BarraEstado[] }) {
  if (datos.length === 0) return null;
  return (
    <ChartContainer ref={contenedorRef} config={CONFIG_ESTADOS} className="max-h-72 w-full font-sans">
      <BarChart data={datos} layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
        <CartesianGrid horizontal={false} stroke={PALETA_GRAFICOS.grisBorde} strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={TIPOGRAFIA} />
        <YAxis type="category" dataKey="name" width={132} tickLine={false} axisLine={false} tick={TIPOGRAFIA} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={[0, 6, 6, 0]} barSize={18}>
          <LabelList dataKey="total" position="right" fill={PALETA_GRAFICOS.grisTexto} fontSize={11} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function GraficoDonut({
  datos,
  total,
  contenedorRef,
}: PropsGrafico & { datos: DonutCobertura[]; total: number }) {
  return (
    <ChartContainer ref={contenedorRef} config={CONFIG_DONUT} className="mx-auto aspect-square max-h-64 font-sans">
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent hideLabel nameKey="name" formatter={(valor, nombre) => [`${valor}`, nombre]} />}
        />
        <Legend wrapperStyle={TIPOGRAFIA} />
        <Pie data={datos} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} strokeWidth={4}>
          {datos.map((entrada, indice) => (
            <Cell key={entrada.name} fill={COLORES_COBERTURA[indice % COLORES_COBERTURA.length]} />
          ))}
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
              const { cx, cy } = viewBox;
              return (
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily={TIPOGRAFIA.fontFamily}>
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
