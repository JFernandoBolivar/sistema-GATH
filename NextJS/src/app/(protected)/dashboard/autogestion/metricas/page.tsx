"use client";

import { useRef, useMemo } from "react";
import useSWR from "swr";

import PageLayout from "@/components/layout/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonutChartCenterText } from "@/components/pie-chart";
import { BarChartLine } from "@/components/barline-chart";

import { getReporteCensoDependencias } from "../api/getInfoAutogestion";
import { useReporteStore } from "@/hooks/use-reporte-store";
import { ReporteFiltersForm } from "../consultar/components/reporte-filters-form";
import type { ReporteCensoData } from "@/app/types/types";

export default function MetricasPage() {
  const reporteSearchParams = useReporteStore((s) => s.searchParams);

  const { data: reportData } = useSWR(
    reporteSearchParams
      ? ["reporte-censo", reporteSearchParams]
      : ["reporte-censo"],
    () => getReporteCensoDependencias(reporteSearchParams || undefined),
    { revalidateOnFocus: false },
  );

  const prevReportRef = useRef<ReporteCensoData | undefined>(undefined);
  const displayReportData = useMemo(() => {
    if (reportData?.data) {
      prevReportRef.current = reportData.data;
    }
    return prevReportRef.current;
  }, [reportData?.data]);

  return (
    <PageLayout
      title="Métricas del Censo"
      description="Visualización de progreso del censo de vivienda"
    >
      <div className="flex flex-col gap-4">
        {displayReportData && (
          (() => {
            const pieTotal = displayReportData.pie_chart.reduce(
              (acc, d) => acc + d.value,
              0,
            );
            const pieChartData = displayReportData.pie_chart.map((d) => ({
              name: d.name,
              value: pieTotal > 0 ? (d.value / pieTotal) * 100 : 0,
            }));

            const respondidos = displayReportData.pie_chart.find(
              (d) => d.name === "Respondido",
            )?.value ?? 0;
            const noRespondidos = displayReportData.pie_chart.find(
              (d) => d.name === "No Respondido",
            )?.value ?? 0;

            const totalRespondidos = displayReportData.bar_chart.reduce(
              (acc, b) => acc + b.respondidos, 0,
            );
            const totalNoRespondidos = displayReportData.bar_chart.reduce(
              (acc, b) => acc + b.no_respondidos, 0,
            );

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Progreso del Censo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <DonutChartCenterText
                      data={pieChartData}
                      total={pieTotal}
                    />
                    <div className="flex gap-6 mt-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#7e4cfe]" />
                        <span>Respondido: <strong>{respondidos}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-[#b597ff]" />
                        <span>No Respondido: <strong>{noRespondidos}</strong></span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Respuestas por Dependencia
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BarChartLine
                      data={displayReportData.bar_chart.map((b) => ({
                        key: b.key,
                        metric1: b.respondidos,
                        metric2: b.no_respondidos,
                      }))}
                    />
                    <div className="flex gap-6 mt-4 text-sm justify-center">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-violet-300" />
                        <span>Respondido: <strong>{totalRespondidos}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-400" />
                        <span>No Respondido: <strong>{totalNoRespondidos}</strong></span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()
        )}

        {!displayReportData && (
          <Card>
            <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
              Cargando métricas...
            </CardContent>
          </Card>
        )}

        <ReporteFiltersForm />
      </div>
    </PageLayout>
  );
}
