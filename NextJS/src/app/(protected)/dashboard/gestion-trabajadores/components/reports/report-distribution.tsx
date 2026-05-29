"use client";

import { getReportTypeNomina } from "../../api/getInfoRac";
import { ApiResponse, ReportTypeNomina } from "@/app/types/types";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ReportDistribution() {
  const [distributionData, setDistributionData] = useState<
    {
      name: string;
      value: number;
    }[]
  >();
  const [report, setReport] = useState<ApiResponse<ReportTypeNomina[]>>({
    message: "",
    status: "",
    data: [],
  });

  useEffect(() => {
    const loadData = async () => {
      const reportData = await getReportTypeNomina();
      setReport(reportData);
    };
    loadData();
  }, []);

  if (report.data && report.data.length > 0) {
    const transformedData = report.data.map((item) => ({
      name: item.tiponominaid__nomina,
      value: item.count,
    }));
    setDistributionData(transformedData);
  }
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
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
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
    </Card>
  );
}
