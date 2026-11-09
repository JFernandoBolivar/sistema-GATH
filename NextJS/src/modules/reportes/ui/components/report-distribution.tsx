"use client";

import { useEffect, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui/card";
import { getReportTypeNomina } from "../services/reportes-catalogos";

const COLORS = [
  "var(--chart-1, #2563eb)",
  "var(--chart-2, #16a34a)",
  "var(--chart-3, #f59e0b)",
  "var(--chart-4, #dc2626)",
  "var(--chart-5, #9333ea)",
];

export function ReportDistribution() {
  const [distributionData, setDistributionData] = useState<
    {
      name: string;
      value: number;
    }[]
  >([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const reportData = await getReportTypeNomina();
        if (reportData.data && reportData.data.length > 0) {
          const transformedData = reportData.data.map((item) => ({
            name: item.tiponominaid__nomina,
            value: item.count,
          }));
          setDistributionData(transformedData);
        }
      } catch (err) {
        console.error("Error cargando distribución de nómina:", err);
      }
    };
    loadData();
  }, []);

  return (
    <Card className="bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Distribución por Departamento
      </h2>
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={distributionData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry) => `${entry.name}: ${entry.value}`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {distributionData?.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card, #fff)",
              border: "1px solid var(--border, #ccc)",
            }}
            labelStyle={{ color: "var(--foreground, #000)" }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default ReportDistribution;
