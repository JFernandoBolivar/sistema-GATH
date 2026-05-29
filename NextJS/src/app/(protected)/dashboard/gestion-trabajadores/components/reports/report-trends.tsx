"use client";

import { Card } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const trendsData = [
  { month: "Ene", employees: 145 },
  { month: "Feb", employees: 149 },
  { month: "Mar", employees: 158 },
  { month: "Abr", employees: 161 },
  { month: "May", employees: 173 },
  { month: "Jun", employees: 177 },
];

export function ReportTrends() {
  return (
    <Card className="bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Tendencias de Personal
      </h2>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={trendsData}>
          <defs>
            <linearGradient id="colorEmployees" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="month" stroke="var(--muted-foreground)" />
          <YAxis stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Area
            type="monotone"
            dataKey="employees"
            stroke="var(--chart-1)"
            fillOpacity={1}
            fill="url(#colorEmployees)"
            name="Total de Empleados"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
