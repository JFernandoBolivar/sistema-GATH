"use client";

/**
 * Componente de presentación pura: distribución de personal activo por tipo
 * de nómina. Recibe los datos ya derivados por `buildDistribucionNominaChartData`
 * (regla R3: ui/ no reimplementa lógica).
 */
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { DistribucionNominaDatum } from "./distribucion-nomina-chart-data";

interface DistribucionNominaPieChartProps {
  data: DistribucionNominaDatum[];
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function DistribucionNominaPieChart({ data }: DistribucionNominaPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => `${entry.name}: ${entry.value}`}
          outerRadius={120}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
