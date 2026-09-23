"use client";

/**
 * Página de consulta del historial de movimientos de trabajadores.
 * Paridad visual y funcional con el sistema de referencia, ampliada con
 * filtros avanzados requeridos por el usuario:
 * - Cédula del empleado
 * - Código de puesto
 * - Tipo de Movimiento (Select)
 * - Gerencia / Dirección General (Select)
 * - Rango de fechas: Fecha Inicio y Fecha Fin (Date inputs)
 * - Estatus del cargo (Select)
 * - Búsqueda rápida en resultados (filtro reactivo instantáneo)
 * - Exportación a PDF con `ReportMovementsPDF`
 * - Hoja de detalle `DetalleMovimiento`
 */
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eraser, Filter, Search, SlidersHorizontal } from "lucide-react";
import { useSession } from "next-auth/react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Badge } from "@/shared/ui/components/badge";
import ExportButton from "@/components/ui/ExportButtonPDF";
import { DataTable } from "@/shared/ui/components/data-table";
import Loading from "@/shared/ui/components/loading";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type { MovimientoCargoDTO } from "../application/dtos/movimientos-dto";
import type { FiltrosMovimiento } from "../domain/ports/repo-movimientos";
import {
  getHistorialGeneralAction,
  getHistorialPorCargoAction,
  getHistorialPorEmpleadoAction,
} from "../infrastructure/actions/movimientos-actions";
import { DetalleMovimiento } from "./detalle-movimiento";
import { construirColumnasMovimientos } from "./movimientos-columns";
import { ReportMovementsPDF } from "./pdf/report-movements-pdf";
import {
  consultaHistorialSchema,
  type ConsultaHistorialFormType,
} from "./schema/schema-historial";

const TIPOS_MOVIMIENTO = [
  "INGRESO",
  "ASIGNACION DE CARGO",
  "ASCENSO PERSONAL EMPLEADO",
  "CLASIFICACION DE CARGO OBRERO",
  "TRASLADO FISICO Y ADMINISTRATIVO A OTRA DEPENDENCIA",
  "TRASLADO DE NOMINA",
  "ENCARGADURIA INTERNA",
  "ENCARGADURIA EN CALIDAD DE COMISION DE SERVICIO",
  "NOMBRAMIENTO DE LIBRE Y REMOCION",
  "CAMBIO DE ESTATUS POR TRAMITES ADMINISTRATIVOS",
  "EGRESO",
  "JUBILACION DE DERECHO",
  "PENSION DE INVALIDEZ",
  "PENSION POR SOBREVIVIENTE",
  "RENUNCIA",
  "DESTITUCION",
  "DESPIDO DE OBRERO",
  "FALLECIMIENTO",
] as const;

const GERENCIAS_OPCIONES = [
  "OFICINA DE SISTEMAS Y TECNOLOGIA DE LA INFORMACION",
  "OFICINA DE GESTION HUMANA",
  "OFICINA DE ATENCION AL CIUDADANO",
  "OFICINA DE GESTION ADMINISTRATIVA",
  "OFICINA DE GESTION COMUNICACIONAL",
  "OFICINA DE INFORMACION ESTADISTICA Y GEOGRAFICA",
  "OFICINA DE PLANIFICACION PRESUPUESTO Y SEGUIMIENTO DE LA GESTION",
  "OFICINA DE PROTECCION Y SEGURIDAD INTEGRAL",
  "GERENCIA DE ADMINISTRACION DE DOMINIOS NIC. VE",
  "GERENCIA DE FORMACION",
  "GERENCIA DE GESTION DE SERVICIOS DE TELECOMUNICACIONES",
  "GERENCIA DE PLANIFICACION Y DESARROLLO DEL SECTOR TELECOMUNICACIONES",
  "GERENCIA DE RECAUDACION Y FISCALIZACION",
  "GERENCIA DE REGIONES",
  "GERENCIA DE RESPONSABILIDAD SOCIAL Y PARTICIPACION",
  "GERENCIA DE SEGUIMIENTO REGULATORIO",
  "CONSULTORIA JURIDICA",
  "DIRECCION GENERAL",
  "UNIDAD DE AUDITORIA INTERNA",
  "CONSEJO DIRECTIVO",
] as const;

const ESTATUS_CARGO = [
  "ACTIVO",
  "PASIVO",
  "VACANTE",
  "SUSPENDIDO",
  "EGRESADO",
] as const;

type TipoConsulta = { tipo: "empleado" | "cargo" | "general"; valor: string } | null;

export default function MovimientosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const esAdmin =
    session?.user?.role?.nombre_rol === "ADMINISTRADOR" || session?.user?.role?.id === 1;
  const puedeVer = esAdmin || tienePermiso(permisos, "movimientos.ver");

  const [movimientos, setMovimientos] = useState<MovimientoCargoDTO[]>([]);
  const [busquedaLibre, setBusquedaLibre] = useState("");
  const [consulta, setConsulta] = useState<TipoConsulta>(null);
  const [buscado, setBuscado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [viendoDetalle, setViendoDetalle] = useState<MovimientoCargoDTO | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);

  const form = useForm<ConsultaHistorialFormType>({
    resolver: zodResolver(consultaHistorialSchema),
    defaultValues: {
      cedulaidentidad: "",
      codigoPuesto: "",
      tipoMovimiento: "ALL",
      fechaInicio: "",
      fechaFin: "",
      gerencia: "ALL",
      estatus: "ALL",
    },
  });

  const onSearch = (values: ConsultaHistorialFormType) => {
    const cedula = values.cedulaidentidad?.trim();
    const codigo = values.codigoPuesto?.trim();
    const tipo = values.tipoMovimiento?.trim();
    const fechaInicio = values.fechaInicio?.trim();
    const fechaFin = values.fechaFin?.trim();
    const gerencia = values.gerencia?.trim();
    const estatus = values.estatus?.trim();

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    if (!puedeVer) return;

    setError(null);
    setBuscado(true);

    startTransition(async () => {
      try {
        const filtros: FiltrosMovimiento = {};
        if (cedula) filtros.cedula = cedula;
        if (codigo) filtros.codigoPuesto = codigo.toUpperCase();
        if (tipo && tipo !== "ALL") filtros.tipoMovimiento = tipo;
        if (fechaInicio) filtros.fechaInicio = fechaInicio;
        if (fechaFin) filtros.fechaFin = fechaFin;
        if (gerencia && gerencia !== "ALL") filtros.gerencia = gerencia;
        if (estatus && estatus !== "ALL") filtros.estatus = estatus;

        let resultado: MovimientoCargoDTO[] | { error: string };

        const soloCedula =
          cedula &&
          !codigo &&
          (!tipo || tipo === "ALL") &&
          !fechaInicio &&
          !fechaFin &&
          (!gerencia || gerencia === "ALL") &&
          (!estatus || estatus === "ALL");

        const soloCodigo =
          codigo &&
          !cedula &&
          (!tipo || tipo === "ALL") &&
          !fechaInicio &&
          !fechaFin &&
          (!gerencia || gerencia === "ALL") &&
          (!estatus || estatus === "ALL");

        if (soloCedula) {
          setConsulta({ tipo: "empleado", valor: cedula });
          resultado = await getHistorialPorEmpleadoAction(cedula);
        } else if (soloCodigo) {
          setConsulta({ tipo: "cargo", valor: codigo.toUpperCase() });
          resultado = await getHistorialPorCargoAction(codigo.toUpperCase());
        } else {
          const partesResumen = [
            cedula ? `Cédula: ${cedula}` : "",
            codigo ? `Puesto: ${codigo}` : "",
            tipo && tipo !== "ALL" ? `Tipo: ${tipo}` : "",
            gerencia && gerencia !== "ALL" ? `Gerencia: ${gerencia}` : "",
            fechaInicio ? `Desde: ${fechaInicio}` : "",
            fechaFin ? `Hasta: ${fechaFin}` : "",
            estatus && estatus !== "ALL" ? `Estatus: ${estatus}` : "",
          ].filter(Boolean);
          setConsulta({
            tipo: "general",
            valor: partesResumen.length > 0 ? partesResumen.join(", ") : "Historial General",
          });
          resultado = await getHistorialGeneralAction(filtros);
        }

        if (resultado && typeof resultado === "object" && "error" in resultado) {
          setError((resultado as { error: string }).error);
          setMovimientos([]);
          return;
        }

        setMovimientos((resultado as MovimientoCargoDTO[]) ?? []);
      } catch {
        setError("No fue posible cargar el historial de movimientos.");
        setMovimientos([]);
      }
    });
  };

  const cleanFields = () => {
    form.reset({
      cedulaidentidad: "",
      codigoPuesto: "",
      tipoMovimiento: "ALL",
      fechaInicio: "",
      fechaFin: "",
      gerencia: "ALL",
      estatus: "ALL",
    });
    setBusquedaLibre("");
    setConsulta(null);
    setMovimientos([]);
    setBuscado(false);
    setError(null);
  };

  const onVerDetalle = (movimiento: MovimientoCargoDTO) => {
    setViendoDetalle(movimiento);
    setDetalleAbierto(true);
  };

  const columnas = useMemo(
    () => construirColumnasMovimientos(onVerDetalle, puedeVer),
    [puedeVer],
  );

  const movimientosFiltrados = useMemo(() => {
    if (!busquedaLibre.trim()) return movimientos;
    const q = busquedaLibre.trim().toLowerCase();
    return movimientos.filter((m) => {
      return (
        m.empleadoCedula?.toLowerCase().includes(q) ||
        m.codigoPuesto?.toLowerCase().includes(q) ||
        m.tipoMovimiento?.toLowerCase().includes(q) ||
        m.motivoNombre?.toLowerCase().includes(q) ||
        m.especificaNombre?.toLowerCase().includes(q) ||
        m.denominacionNombre?.toLowerCase().includes(q) ||
        m.direccionGeneralNombre?.toLowerCase().includes(q) ||
        m.ejecutadoPorNombre?.toLowerCase().includes(q) ||
        m.estatusNombre?.toLowerCase().includes(q)
      );
    });
  }, [movimientos, busquedaLibre]);

  const pdfDocument = useMemo(
    () => (
      <ReportMovementsPDF
        moves={movimientosFiltrados}
        cedula={consulta?.tipo === "empleado" ? consulta.valor : ""}
        userName={session?.user?.name}
      />
    ),
    [movimientosFiltrados, consulta, session?.user?.name],
  );

  return (
    <PageLayout
      title="Consulta De Movimientos De Trabajadores"
      description="Verifique El Movimiento Del Personal"
    >
      <div className="flex flex-col gap-4 mt-2">
        {!puedeVer && (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive font-medium"
          >
            No tiene permisos suficientes para consultar el historial de movimientos de personal (se requiere movimientos.ver).
          </div>
        )}

        <div className="rounded-xl border bg-card text-card-foreground p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b">
            <SlidersHorizontal className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Filtros de Búsqueda</h2>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSearch)}
              className="flex flex-col gap-4"
              noValidate
            >
              {/* Fila 1: Cédula, Código Puesto, Tipo de Movimiento, Gerencia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  name="cedulaidentidad"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buscar Cédula</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-white"
                          type="text"
                          placeholder="buscar cédula..."
                          disabled={!puedeVer || isPending}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="codigoPuesto"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buscar Código Puesto</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-white"
                          type="text"
                          placeholder="buscar código puesto..."
                          disabled={!puedeVer || isPending}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="tipoMovimiento"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Movimiento</FormLabel>
                      <Select
                        value={field.value || "ALL"}
                        onValueChange={(val) => field.onChange(val === "ALL" ? "" : val)}
                        disabled={!puedeVer || isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white w-full">
                            <SelectValue placeholder="Todos los tipos" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-72">
                          <SelectItem value="ALL">Todos los tipos</SelectItem>
                          {TIPOS_MOVIMIENTO.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  name="gerencia"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gerencia / Dirección</FormLabel>
                      <Select
                        value={field.value || "ALL"}
                        onValueChange={(val) => field.onChange(val === "ALL" ? "" : val)}
                        disabled={!puedeVer || isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white w-full">
                            <SelectValue placeholder="Todas las gerencias" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-72">
                          <SelectItem value="ALL">Todas las gerencias</SelectItem>
                          {GERENCIAS_OPCIONES.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              {/* Fila 2: Fecha Inicio, Fecha Fin, Estatus, Acciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <FormField
                  name="fechaInicio"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha Inicio</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-white"
                          type="date"
                          disabled={!puedeVer || isPending}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="fechaFin"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha Fin</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-white"
                          type="date"
                          disabled={!puedeVer || isPending}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="estatus"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estatus del Cargo</FormLabel>
                      <Select
                        value={field.value || "ALL"}
                        onValueChange={(val) => field.onChange(val === "ALL" ? "" : val)}
                        disabled={!puedeVer || isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white w-full">
                            <SelectValue placeholder="Todos los estatus" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ALL">Todos los estatus</SelectItem>
                          {ESTATUS_CARGO.map((est) => (
                            <SelectItem key={est} value={est}>
                              {est}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    className="flex-1 cursor-pointer"
                    disabled={isPending || !puedeVer}
                  >
                    Buscar <Search className="size-4 ml-1.5" />
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 cursor-pointer"
                    type="button"
                    onClick={cleanFields}
                    disabled={isPending}
                  >
                    Limpiar <Eraser className="size-4 ml-1.5" />
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive font-medium px-1">
            {error}
          </p>
        )}

        {/* Toolbar de resultados: Búsqueda rápida, badge de cantidad y Export PDF */}
        {movimientos.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-lg border">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filtrar resultados (cédula, puesto, cargo, usuario...)"
                value={busquedaLibre}
                onChange={(e) => setBusquedaLibre(e.target.value)}
                className="pl-8 bg-white h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-3 justify-between sm:justify-end">
              <Badge variant="outline" className="text-xs font-normal">
                {movimientosFiltrados.length === movimientos.length
                  ? `${movimientos.length} movimiento(s)`
                  : `${movimientosFiltrados.length} de ${movimientos.length} movimiento(s)`}
              </Badge>

              <ExportButton
                document={pdfDocument}
                fileName={`historial-movimientos-${consulta?.tipo === "empleado" ? consulta.valor : "reporte"}.pdf`}
                buttonText="Descargar PDF"
              />
            </div>
          </div>
        )}

        {isPending ? (
          <Loading promiseMessage="Cargando Información" />
        ) : (
          <DataTable
            columns={columnas}
            data={movimientosFiltrados}
            emptyMessage={
              buscado
                ? "No hay movimientos registrados para los criterios indicados."
                : "Configure los filtros y presione Buscar para consultar el historial de movimientos."
            }
          />
        )}

        <DetalleMovimiento
          movimiento={viendoDetalle}
          open={detalleAbierto}
          onOpenChange={setDetalleAbierto}
        />
      </div>
    </PageLayout>
  );
}
