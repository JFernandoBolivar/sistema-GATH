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
import { useIsMobile } from "@/shared/hooks/use-mobile";

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

const CARACTERES_POR_LINEA = 14;
const ALTO_MINIMO_MOVIL = 280;
const ALTO_POR_CATEGORIA = 46;

/** Parte una etiqueta larga en líneas completas (sin cortar palabras ni truncar). */
export function envolverTexto(texto: string, maximo: number = CARACTERES_POR_LINEA): string[] {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  for (const palabra of palabras) {
    const ultima = lineas[lineas.length - 1];
    if (ultima && `${ultima} ${palabra}`.length <= maximo) {
      lineas[lineas.length - 1] = `${ultima} ${palabra}`;
    } else {
      lineas.push(palabra);
    }
  }
  return lineas.length > 0 ? lineas : [""];
}

/** Altura del gráfico horizontal: crece con el número de categorías. */
export function alturaGraficoTipos(categorias: number): number {
  return Math.max(ALTO_MINIMO_MOVIL, categorias * ALTO_POR_CATEGORIA + 72);
}

/** No pinta etiquetas para los valores 0 (se encimaban con la barra). */
export function etiquetaValor(valor: unknown): string {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? String(numero) : "";
}

function TickEnvuelto({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) {
  const lineas = envolverTexto(String(payload?.value ?? ""));
  const alto = lineas.length * 12;
  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      fill={PALETA_GRAFICOS.grisTexto}
      fontSize={11}
      fontFamily={TIPOGRAFIA.fontFamily}
    >
      {lineas.map((linea, indice) => (
        <tspan key={`${linea}-${indice}`} x={x} dy={indice === 0 ? 3 - alto / 2 : 12}>
          {linea}
        </tspan>
      ))}
    </text>
  );
}

export function GraficoTipos({ datos, contenedorRef }: PropsGrafico & { datos: BarraTipo[] }) {
  const esMovil = useIsMobile();
  if (datos.length === 0) return null;

  if (esMovil) {
    const datosConTotal = datos.map((fila) => ({
      ...fila,
      total: fila.respondieron + fila.faltan,
    }));
    return (
      <ChartContainer
        ref={contenedorRef}
        config={CONFIG_TIPOS}
        className="aspect-auto w-full font-sans"
        style={{ height: alturaGraficoTipos(datos.length) }}
      >
        <BarChart
          data={datosConTotal}
          layout="vertical"
          margin={{ top: 8, right: 28, left: 16, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke={PALETA_GRAFICOS.grisBorde} strokeDasharray="3 3" />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={TIPOGRAFIA}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={104}
            interval={0}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={<TickEnvuelto />}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend verticalAlign="bottom" align="center" height={28} wrapperStyle={TIPOGRAFIA} />
          <Bar
            dataKey="respondieron"
            name="Respondieron"
            stackId="cobertura"
            fill="var(--color-respondieron)"
            barSize={18}
            minPointSize={2}
          />
          <Bar
            dataKey="faltan"
            name="Faltan"
            stackId="cobertura"
            fill="var(--color-faltan)"
            barSize={18}
            minPointSize={2}
          >
            <LabelList
              dataKey="total"
              position="right"
              fill={PALETA_GRAFICOS.grisTexto}
              fontSize={11}
              fontWeight={600}
              formatter={etiquetaValor}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    );
  }

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
