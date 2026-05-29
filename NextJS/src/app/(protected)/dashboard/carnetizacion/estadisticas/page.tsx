"use client";
import PageLayout from "@/components/layout/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  IdCard,
  CalendarDays,
  Clock,
  Loader2,
  TrendingUp,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import useSWR from "swr";
import { getEstadisticas } from "../api/getInfoCarnet";
import type { UltimoCarnet } from "../types/carnetizacion";

export default function EstadisticasPage() {
  const { data: stats, isLoading } = useSWR(
    "estadisticas-carnetizacion",
    getEstadisticas,
  );

  if (isLoading) {
    return (
      <PageLayout title="Estadísticas">
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Estadísticas de Carnetización"
      description="Resumen de carnets generados y uso del sistema"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Carnets
                </p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {stats?.total || 0}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Carnets Activos
                </p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">
                  {stats?.activos || 0}
                </p>
              </div>
              <div className="bg-emerald-100 rounded-full p-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Generados Hoy
                </p>
                <p className="text-3xl font-bold text-amber-600 mt-1">
                  {stats?.hoy || 0}
                </p>
              </div>
              <div className="bg-amber-100 rounded-full p-3">
                <CalendarDays className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Este Mes
                </p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {stats?.this_month || 0}
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Últimos Carnets Generados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.ultimos && stats.ultimos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Trabajador</th>
                    <th className="pb-3 font-medium">C.I</th>
                    <th className="pb-3 font-medium">Fecha</th>
                    <th className="pb-3 font-medium">Motivo</th>
                    <th className="pb-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.ultimos.map((carnet: UltimoCarnet, i: number) => (
                    <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 font-medium">{carnet.nombre}</td>
                      <td className="py-3 text-muted-foreground">{carnet.cedula}</td>
                      <td className="py-3 text-muted-foreground">{carnet.fecha}</td>
                      <td className="py-3">
                        <Badge variant="outline">{carnet.motivo}</Badge>
                      </td>
                      <td className="py-3">
                        {carnet.activo ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactivo
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <IdCard className="h-12 w-12 mx-auto text-gray-300" />
              <p className="text-muted-foreground mt-4">
                No hay carnets generados aún
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
