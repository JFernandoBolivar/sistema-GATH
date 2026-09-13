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
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
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
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dependencia</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ingreso</TableHead>
                  <TableHead>APN (años)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personal.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-16 text-center text-muted-foreground">Sin datos para el reporte.</TableCell></TableRow>
                ) : (
                  personal.map((r, i) => (
                    <TableRow key={`${r.cedula}-${i}`}>
                      <TableCell className="font-medium">{r.cedula}</TableCell>
                      <TableCell>{r.nombreCompleto}</TableCell>
                      <TableCell>{r.dependencia}</TableCell>
                      <TableCell>{r.cargo}</TableCell>
                      <TableCell>{r.tipoPersonal}</TableCell>
                      <TableCell>{r.fechaIngreso}</TableCell>
                      <TableCell>{r.totalAnosApn}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pasivos">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Egreso</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pasivos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">Sin datos para el reporte.</TableCell></TableRow>
                ) : (
                  pasivos.map((r, i) => (
                    <TableRow key={`${r.cedula}-${i}`}>
                      <TableCell className="font-medium">{r.cedula}</TableCell>
                      <TableCell>{r.nombreCompleto}</TableCell>
                      <TableCell>{r.tipoPersonal}</TableCell>
                      <TableCell>{r.fechaEgreso}</TableCell>
                      <TableCell>{r.motivoEgreso}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="vacantes">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Denominación</TableHead>
                  <TableHead>Dependencia</TableHead>
                  <TableHead>Dirección general</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacantes.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-16 text-center text-muted-foreground">Sin datos para el reporte.</TableCell></TableRow>
                ) : (
                  vacantes.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.codigoNomina ?? "—"}</TableCell>
                      <TableCell>{r.denominacionCargo}</TableCell>
                      <TableCell>{r.dependencia}</TableCell>
                      <TableCell>{r.direccionGeneral}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="familiares">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cédula familiar</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Parentesco</TableHead>
                  <TableHead>Sexo</TableHead>
                  <TableHead>Nacimiento</TableHead>
                  <TableHead>Cédula empleado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {familiares.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">Sin datos para el reporte.</TableCell></TableRow>
                ) : (
                  familiares.map((r, i) => (
                    <TableRow key={`${r.cedulaFamiliar}-${i}`}>
                      <TableCell className="font-medium">{r.cedulaFamiliar}</TableCell>
                      <TableCell>{r.nombres} {r.apellidos}</TableCell>
                      <TableCell>{r.parentesco}</TableCell>
                      <TableCell>{r.sexo}</TableCell>
                      <TableCell>{r.fechaNacimiento}</TableCell>
                      <TableCell>{r.cedulaEmpleado}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="codigos">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Cargo específico</TableHead>
                  <TableHead>Nómina</TableHead>
                  <TableHead>Dependencia</TableHead>
                  <TableHead>Estatus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codigos.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">Sin datos para el reporte.</TableCell></TableRow>
                ) : (
                  codigos.map((r, i) => (
                    <TableRow key={`${r.codigo}-${i}`}>
                      <TableCell className="font-medium">{r.codigo}</TableCell>
                      <TableCell>{r.cargo}</TableCell>
                      <TableCell>{r.cargoEspecifico}</TableCell>
                      <TableCell>{r.tipoNomina}</TableCell>
                      <TableCell>{r.dependencia}</TableCell>
                      <TableCell>{r.estatus}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="egresados">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onDescargar("pdf")} disabled={isPending}><FileDown className="size-4" aria-hidden="true" /> PDF</Button>
            <Button variant="outline" size="sm" onClick={() => onDescargar("excel")} disabled={isPending}><FileSpreadsheet className="size-4" aria-hidden="true" /> Excel</Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Egreso</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {egresados.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">Sin datos para el reporte. Use los filtros de fecha de egreso y presione &quot;Generar&quot;.</TableCell></TableRow>
                ) : (
                  egresados.map((r, i) => (
                    <TableRow key={`${r.cedula}-${i}`}>
                      <TableCell className="font-medium">{r.cedula}</TableCell>
                      <TableCell>{r.nombreCompleto}</TableCell>
                      <TableCell>{r.tipoPersonal}</TableCell>
                      <TableCell>{r.fechaEgreso}</TableCell>
                      <TableCell>{r.motivoEgreso}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
