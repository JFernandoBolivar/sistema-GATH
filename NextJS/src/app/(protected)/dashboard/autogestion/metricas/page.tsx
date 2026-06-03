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

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Progreso del Censo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <DonutChartCenterText
                      data={pieChartData}
                      total={pieTotal}
                    />
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
