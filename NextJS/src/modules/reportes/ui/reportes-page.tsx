"use client";

/**
 * Página de reportes (solo lectura) — personal activo, pasivos y vacantes.
 * Cliente + react-hook-form + zodResolver; la consulta va envuelta en
 * useTransition (R8) y se delega a las Server Actions del módulo (R7). Opera
 * exclusivamente con DTOs (R5) y no importa de `infrastructure/` (R3).
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart3, FileDown, FileSpreadsheet, Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { DataTable } from "@/shared/ui/components/data-table";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/components/tabs";

import type {
  DistribucionNominaDTO,
  ReporteItemCodigoDTO,
  ReporteItemFamiliarDTO,
  ReporteItemPasivoDTO,
  ReporteItemPersonalDTO,
  ReporteItemVacanteDTO,
  TendenciaPeriodoDTO,
} from "../application/dtos/reporte-dto";
import type { TipoReportePersonal } from "../domain/value-objects/tipo-reporte-vo";
import {
  descargarReporteExcelAction,
  descargarReportePdfAction,
  getDistribucionNominaAction,
  getReporteCodigosAction,
  getReporteEgresadosAction,
  getReporteFamiliaresAction,
  getReportePasivosAction,
  getReportePersonalAction,
  getReporteVacantesAction,
  getTendenciasPersonalAction,
} from "../infrastructure/actions/reportes-actions";
import { reporteFilterSchema, type ReporteFilterType } from "./schema/schema-reporte";
import { buildDistribucionNominaChartData } from "./distribucion-nomina-chart-data";
import { DistribucionNominaPieChart } from "./distribucion-nomina-pie-chart";
import { buildTendenciaChartData } from "./tendencia-chart-data";
import { TendenciaLineChart } from "./tendencia-line-chart";
import {
  construirColumnasReporteCodigos,
  construirColumnasReporteFamiliares,
  construirColumnasReportePasivos,
  construirColumnasReportePersonal,
  construirColumnasReporteVacantes,
} from "./reportes-columnas";

type Tab =
  | "personal"
  | "pasivos"
  | "vacantes"
  | "familiares"
  | "codigos"
  | "tendencias"
  | "egresados"
  | "distribucion";

const TAB_A_TIPO_REPORTE: Record<Tab, TipoReportePersonal> = {
  personal: "personal-activo",
  pasivos: "personal-pasivo",
  vacantes: "vacantes",
  familiares: "familiares",
  codigos: "codigos",
  tendencias: "tendencias",
  egresados: "personal-pasivo",
  distribucion: "distribucion-nomina",
};

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>("personal");
  const [personal, setPersonal] = useState<ReporteItemPersonalDTO[]>([]);
  const [pasivos, setPasivos] = useState<ReporteItemPasivoDTO[]>([]);
  const [vacantes, setVacantes] = useState<ReporteItemVacanteDTO[]>([]);
  const [familiares, setFamiliares] = useState<ReporteItemFamiliarDTO[]>([]);
  const [codigos, setCodigos] = useState<ReporteItemCodigoDTO[]>([]);
  const [tendencias, setTendencias] = useState<TendenciaPeriodoDTO[]>([]);
  const [tendenciasCargadas, setTendenciasCargadas] = useState(false);
  const [egresados, setEgresados] = useState<ReporteItemPasivoDTO[]>([]);
  const [distribucion, setDistribucion] = useState<DistribucionNominaDTO[]>([]);
  const [distribucionCargada, setDistribucionCargada] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ReporteFilterType>({
    resolver: zodResolver(reporteFilterSchema),
    defaultValues: {},
  });

  const cargar = (fn: () => Promise<void>) => {
    startTransition(async () => {
      setError(null);
      try {
        await fn();
      } catch {
        setError("No fue posible cargar el reporte.");
      }
    });
  };

  const cargarPersonal = (dependenciaId?: number) =>
    cargar(async () => setPersonal(await getReportePersonalAction({ dependenciaId })));
  const cargarPasivos = () =>
    cargar(async () => setPasivos(await getReportePasivosAction()));
  const cargarVacantes = (dependenciaId?: number) =>
    cargar(async () => setVacantes(await getReporteVacantesAction({ dependenciaId })));
  const cargarFamiliares = () =>
    cargar(async () => setFamiliares(await getReporteFamiliaresAction()));
  const cargarCodigos = (dependenciaId?: number) =>
    cargar(async () => setCodigos(await getReporteCodigosAction({ dependenciaId })));
  const cargarTendencias = () =>
    cargar(async () => {
      setTendencias(await getTendenciasPersonalAction());
      setTendenciasCargadas(true);
    });
  const cargarEgresados = (fechaEgresoDesde?: string, fechaEgresoHasta?: string) =>
    cargar(async () =>
      setEgresados(await getReporteEgresadosAction({ fechaEgresoDesde, fechaEgresoHasta }))
    );
  const cargarDistribucion = () =>
    cargar(async () => {
      setDistribucion(await getDistribucionNominaAction());
      setDistribucionCargada(true);
    });

  const onSubmit = (data: ReporteFilterType) => {
    if (tab === "personal") cargarPersonal(data.dependenciaId);
    else if (tab === "vacantes") cargarVacantes(data.dependenciaId);
    else if (tab === "codigos") cargarCodigos(data.dependenciaId);
    else if (tab === "familiares") cargarFamiliares();
    else if (tab === "tendencias") cargarTendencias();
    else if (tab === "egresados") cargarEgresados(data.fechaEgresoDesde, data.fechaEgresoHasta);
    else if (tab === "distribucion") cargarDistribucion();
    else cargarPasivos();
  };

  const onDescargar = (formato: "pdf" | "excel") => {
    startTransition(async () => {
      setError(null);
      const tipo = TAB_A_TIPO_REPORTE[tab];
      const resultado =
        formato === "pdf"
          ? await descargarReportePdfAction(tipo)
          : await descargarReporteExcelAction(tipo);
      if (!(resultado instanceof Blob)) {
        setError((resultado as { error: string }).error ?? "No fue posible descargar el archivo.");
        return;
      }
      const url = window.URL.createObjectURL(resultado);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-${tipo}.${formato}`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  useEffect(() => {
    cargarPersonal();
  }, []);

  useEffect(() => {
    if (tab === "tendencias" && !tendenciasCargadas) cargarTendencias();
  }, [tab, tendenciasCargadas]);

  useEffect(() => {
    if (tab === "distribucion" && !distribucionCargada) cargarDistribucion();
  }, [tab, distribucionCargada]);

  const columnasPersonal = construirColumnasReportePersonal();
  const columnasPasivos = construirColumnasReportePasivos();
  const columnasVacantes = construirColumnasReporteVacantes();
  const columnasFamiliares = construirColumnasReporteFamiliares();
  const columnasCodigos = construirColumnasReporteCodigos();
  const columnasEgresados = construirColumnasReportePasivos();

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <BarChart3 className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Reportes</h1>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Genere los reportes de personal activo, pasivos, puestos vacantes, familiares,
            códigos de cargo, egresados detallados, la tendencia mensual de ingresos/egresos o
            la distribución de personal por tipo de nómina.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-4 md:w-72">
              {tab === "egresados" ? (
                <>
                  <Field>
                    <Label htmlFor="fechaEgresoDesde">Fecha de egreso desde</Label>
                    <Input
                      type="date"
                      id="fechaEgresoDesde"
                      {...form.register("fechaEgresoDesde")}
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="fechaEgresoHasta">Fecha de egreso hasta</Label>
                    <Input
                      type="date"
                      id="fechaEgresoHasta"
                      {...form.register("fechaEgresoHasta")}
                    />
                  </Field>
                </>
              ) : (
                <Field>
                  <Label htmlFor="dependenciaId">Dependencia (opcional)</Label>
                  <Input
                    type="number"
                    id="dependenciaId"
                    placeholder="Id de dependencia"
                    {...form.register("dependenciaId", { valueAsNumber: true })}
                  />
                </Field>
              )}
            </div>
            <div>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <BarChart3 className="size-4" aria-hidden="true" />}
                Generar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="personal">Personal activo</TabsTrigger>
          <TabsTrigger value="pasivos">Pasivos</TabsTrigger>
          <TabsTrigger value="vacantes">Vacantes</TabsTrigger>
          <TabsTrigger value="familiares">Familiares</TabsTrigger>
          <TabsTrigger value="codigos">Códigos</TabsTrigger>
          <TabsTrigger value="egresados">Egresados</TabsTrigger>
          <TabsTrigger value="tendencias">Tendencias</TabsTrigger>
          <TabsTrigger value="distribucion">Distribución por nómina</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <DataTable columns={columnasPersonal} data={personal} emptyMessage="Sin datos para el reporte." />
        </TabsContent>

        <TabsContent value="pasivos">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <DataTable columns={columnasPasivos} data={pasivos} emptyMessage="Sin datos para el reporte." />
        </TabsContent>

        <TabsContent value="vacantes">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <DataTable columns={columnasVacantes} data={vacantes} emptyMessage="Sin datos para el reporte." />
        </TabsContent>

        <TabsContent value="familiares">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <DataTable columns={columnasFamiliares} data={familiares} emptyMessage="Sin datos para el reporte." />
        </TabsContent>

        <TabsContent value="codigos">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <DataTable columns={columnasCodigos} data={codigos} emptyMessage="Sin datos para el reporte." />
        </TabsContent>

        <TabsContent value="egresados">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <DataTable
            columns={columnasEgresados}
            data={egresados}
            emptyMessage='Sin datos para el reporte. Use los filtros de fecha de egreso y presione "Generar".'
          />
        </TabsContent>

        <TabsContent value="tendencias">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ingresos y egresos de personal (últimos 12 meses)</CardTitle>
              <CardDescription>Serie mensual real, calculada a partir de los antecedentes de servicio y egresos registrados.</CardDescription>
            </CardHeader>
            <CardContent>
              {tendencias.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin datos para la tendencia.</p>
              ) : (
                <TendenciaLineChart data={buildTendenciaChartData(tendencias)} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribucion">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distribución de personal activo por tipo de nómina</CardTitle>
              <CardDescription>Conteo de asignaciones de cargo con empleado (sin vacantes), agrupado por tipo de nómina.</CardDescription>
            </CardHeader>
            <CardContent>
              {distribucion.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin datos para la distribución.</p>
              ) : (
                <DistribucionNominaPieChart data={buildDistribucionNominaChartData(distribucion)} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
