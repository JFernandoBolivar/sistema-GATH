"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Award,
  Eye,
  IdCard,
  Loader2,
  Printer,
  QrCode,
  RotateCw,
  Search,
  User,
  X,
} from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatearFecha } from "@/shared/lib/formato-fecha";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  actualizarVistaPreviaAction,
  buscarPersonalCarnetAction,
  generarCarnetPdfAction,
  getMotivosCarnetAction,
  getPlantillasCarnetAction,
} from "../../infrastructure/actions/carnetizacion-actions";
import type { EmployeeCarnet, MotivoOption, PlantillaCarnet } from "../../domain/entities/carnet";

function truncarNombre(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 3) return nombreCompleto;
  const nombres = partes.slice(0, 2);
  const apellidos = partes.slice(-2);
  return [...nombres, ...apellidos].join(" ");
}

function downloadPdfBase64(base64: string, filename: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  document.body.removeChild(a);
}

type FiltroRapido = "todos" | "activos" | "pasivos" | "sin_carnet";

const MOTIVOS_REEMISION = [
  { value: "PERDIDA_ROBO", label: "Pérdida o robo" },
  { value: "DETERIORO", label: "Deterioro" },
  { value: "CAMBIO_DATOS", label: "Cambio de datos" },
  { value: "CAMBIO_CARGO", label: "Cambio de cargo" },
  { value: "OTRO", label: "Otro" },
] as const;

const DETALLE_REEMISION_MIN = 10;

export function ConsolaEmisionView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cedulaParam = searchParams.get("cedula") || "";

  const [busqueda, setBusqueda] = useState(cedulaParam);
  const [debouncedQuery, setDebouncedQuery] = useState(cedulaParam);
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>("todos");
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState<EmployeeCarnet | null>(null);
  const [caraPreview, setCaraPreview] = useState<"anverso" | "reverso">("anverso");

  const [motivoId, setMotivoId] = useState<number>(0);
  const [plantillaId, setPlantillaId] = useState<string>("activa");
  const [observaciones, setObservaciones] = useState("");
  const [motivoReemision, setMotivoReemision] = useState<string>("");
  const [detalleReemision, setDetalleReemision] = useState("");
  const [avisoReemision, setAvisoReemision] = useState<string | null>(null);
  const [vistaPreviaRaster, setVistaPreviaRaster] = useState<string>("");
  const [isPendingEmision, startTransitionEmision] = useTransition();
  // Cédula con vista previa en curso (ref: evita lanzar una segunda petición para la misma
  // cédula) y cédula actualmente seleccionada (para descartar respuestas de otra selección).
  const [generandoPreview, setGenerandoPreview] = useState(false);
  const previewEnCursoRef = useRef<string | null>(null);
  const cedulaActualRef = useRef<string | null>(null);

  // Debounce para búsqueda en vivo
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(busqueda.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // Consulta de trabajadores
  const { data: resultadosBusqueda, isLoading: isLoadingBusqueda } = useSWR(
    debouncedQuery.length >= 2 ? ["busqueda-consola-carnet", debouncedQuery] : null,
    async () => {
      const resp = await buscarPersonalCarnetAction(debouncedQuery);
      if (Array.isArray(resp)) {
        return resp as EmployeeCarnet[];
      }
      return [];
    },
    {
      revalidateOnFocus: false,
    },
  );

  // Consulta de catálogo de motivos
  const { data: listaMotivos } = useSWR<MotivoOption[]>(
    "motivos-carnet-consola",
    async () => {
      const resp = await getMotivosCarnetAction();
      if (Array.isArray(resp)) return resp as MotivoOption[];
      return [];
    },
    { revalidateOnFocus: false },
  );

  // Consulta de plantillas disponibles
  const { data: plantillasLegacy } = useSWR<PlantillaCarnet[]>(
    "plantillas-carnet-consola",
    async () => {
      const resp = await getPlantillasCarnetAction();
      if (Array.isArray(resp)) return resp as PlantillaCarnet[];
      return [];
    },
    { revalidateOnFocus: false },
  );

  // Motivo efectivo derivado del catálogo
  const motivoEfectivoId = motivoId || (listaMotivos?.[0]?.id ?? 1);

  // T2: si la persona ya tiene un carnet vigente hay que indicar el motivo.
  const tieneCarnetVigente = Boolean(trabajadorSeleccionado?.tiene_carnet);
  const requiereDetalleReemision = motivoReemision === "OTRO";
  const reemisionCompleta =
    !tieneCarnetVigente ||
    (Boolean(motivoReemision) &&
      (!requiereDetalleReemision ||
        detalleReemision.trim().length >= DETALLE_REEMISION_MIN));
  const fechaCarnetVigente = trabajadorSeleccionado?.carnet_activo_emitido_en
    ? formatearFecha(trabajadorSeleccionado.carnet_activo_emitido_en)
    : null;

  // Si viene con parámetro ?cedula=, preseleccionar automáticamente al trabajador
  useEffect(() => {
    let activo = true;
    if (cedulaParam && (!trabajadorSeleccionado || trabajadorSeleccionado.cedula !== cedulaParam)) {
      buscarPersonalCarnetAction(cedulaParam).then((lista) => {
        if (activo && Array.isArray(lista) && lista.length > 0) {
          const match = (lista as EmployeeCarnet[]).find((e) => e.cedula === cedulaParam) || (lista[0] as EmployeeCarnet);
          setTrabajadorSeleccionado(match);
        }
      });
    }
    return () => {
      activo = false;
    };
  }, [cedulaParam, trabajadorSeleccionado]);

  // Genera la vista previa (≈ segundos): una sola petición por cédula a la vez.
  const solicitarVistaPrevia = useCallback(
    async (cedula: string, nombreCompleto: string): Promise<boolean | null> => {
      if (previewEnCursoRef.current === cedula) return null;
      previewEnCursoRef.current = cedula;
      setGenerandoPreview(true);
      try {
        const res = await actualizarVistaPreviaAction(cedula, truncarNombre(nombreCompleto));
        const ok = Boolean(res.success && res.vista_previa);
        if (ok && cedulaActualRef.current === cedula) {
          setVistaPreviaRaster(res.vista_previa as string);
        }
        return ok;
      } finally {
        if (previewEnCursoRef.current === cedula) {
          previewEnCursoRef.current = null;
          setGenerandoPreview(false);
        }
      }
    },
    [],
  );

  // Actualizar vista previa rasterizada cuando se selecciona un trabajador
  useEffect(() => {
    cedulaActualRef.current = trabajadorSeleccionado?.cedula ?? null;
    if (!trabajadorSeleccionado) return;
    void solicitarVistaPrevia(trabajadorSeleccionado.cedula, trabajadorSeleccionado.nombre_completo);
  }, [trabajadorSeleccionado, solicitarVistaPrevia]);

  // Filtrado rápido sobre los resultados
  const resultadosFiltrados = useMemo(() => {
    const list = Array.isArray(resultadosBusqueda) ? resultadosBusqueda : [];
    if (filtroRapido === "todos") return list;
    if (filtroRapido === "sin_carnet") {
      return list.filter((e) => !e.tiene_carnet);
    }
    if (filtroRapido === "activos") {
      return list.filter(
        (e) => !e.cargo?.toLowerCase().includes("jubilad") && !e.departamento?.toLowerCase().includes("pasiv"),
      );
    }
    if (filtroRapido === "pasivos") {
      return list.filter(
        (e) => e.cargo?.toLowerCase().includes("jubilad") || e.departamento?.toLowerCase().includes("pasiv"),
      );
    }
    return list;
  }, [resultadosBusqueda, filtroRapido]);

  const handleSeleccionarTrabajador = (emp: EmployeeCarnet) => {
    setTrabajadorSeleccionado(emp);
    setBusqueda(emp.cedula);
    setDebouncedQuery(emp.cedula);
    setMotivoReemision("");
    setDetalleReemision("");
    setAvisoReemision(null);
  };

  const handleLimpiarSeleccion = () => {
    setTrabajadorSeleccionado(null);
    setBusqueda("");
    setDebouncedQuery("");
    setVistaPreviaRaster("");
    setMotivoReemision("");
    setDetalleReemision("");
    setAvisoReemision(null);
  };

  const handleActualizarPreview = async () => {
    if (!trabajadorSeleccionado || generandoPreview || isPendingEmision) return;
    const ok = await solicitarVistaPrevia(
      trabajadorSeleccionado.cedula,
      trabajadorSeleccionado.nombre_completo,
    );
    if (ok === null) return;
    if (ok) {
      toast.success("Vista previa actualizada con los datos vigentes.");
    } else {
      toast.info("Vista previa vectorial en vivo activa.");
    }
  };

  const handleEmitirCarnet = () => {
    if (isPendingEmision) return;
    if (!trabajadorSeleccionado) {
      toast.error("Seleccione un trabajador antes de emitir.");
      return;
    }
    if (!motivoEfectivoId) {
      toast.error("Seleccione un motivo de emisión válido.");
      return;
    }
    if (!reemisionCompleta) {
      toast.error("Indique el motivo de la reemisión para continuar.");
      return;
    }

    startTransitionEmision(async () => {
      const cedula = trabajadorSeleccionado.cedula;
      const nombre = truncarNombre(trabajadorSeleccionado.nombre_completo);

      try {
        const result = await generarCarnetPdfAction(
          cedula,
          motivoEfectivoId,
          nombre,
          plantillaId === "activa" ? undefined : plantillaId,
          {
            motivoReemision: tieneCarnetVigente ? motivoReemision : undefined,
            detalle:
              tieneCarnetVigente && requiereDetalleReemision
                ? detalleReemision.trim()
                : undefined,
            observaciones: observaciones.trim() || undefined,
          },
        );
        if (!result.success || !result.data) {
          if (result.status === 409) {
            setAvisoReemision(result.message);
          }
          toast.error(result.message || "No fue posible generar el carnet oficial.");
          return;
        }

        downloadPdfBase64(result.data, `carnet_CONATEL_${cedula}.pdf`);
        toast.success(`Carnet emitido y descargado exitosamente para C.I. ${cedula}.`);
        setAvisoReemision(null);
        setMotivoReemision("");
        setDetalleReemision("");

        // Actualizar el estado local para reflejar la nueva emisión
        setTrabajadorSeleccionado((prev) =>
          prev
            ? {
                ...prev,
                tiene_carnet: true,
                total_solicitudes: (prev.total_solicitudes || 0) + 1,
                carnet_activo_emitido_en: new Date().toISOString(),
              }
            : null,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error durante la emisión del carnet.";
        toast.error(msg);
      }
    });
  };

  return (
    <PageLayout
      title="Consola de Emisión de Credenciales"
      description="Localice al titular, verifique su estado de identidad y emita el carnet oficial con vista previa en tiempo real."
    >
      <div className="space-y-6 mt-4">
        {/* Barra Superior con Estado del Motor */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              Consola de Emisión Centralizada (O51)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/carnetizacion/solicitudes")}
              className="text-xs font-medium"
            >
              <Award className="size-3.5 mr-1.5 text-muted-foreground" />
              Bandeja de Solicitudes
            </Button>
          </div>
        </div>

        {/* 1. Barra de Búsqueda Viva Universal */}
        <Card className="border-border/60 shadow-sm bg-card">
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search
                className="size-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value.slice(0, 60))}
                placeholder="Buscar por cédula, nombre o código de cargo (ej. 18456789 o Bolívar)..."
                className="h-11 pl-11 pr-10 text-sm bg-background border-input [&::-webkit-search-cancel-button]:hidden [&::-ms-clear]:hidden"
                aria-label="Buscar personal para emisión de carnet"
              />
              {busqueda.length > 0 && (
                <button
                  type="button"
                  onClick={handleLimpiarSeleccion}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Filtros Rápidos */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-muted-foreground">Filtros rápidos:</span>
              <Button
                type="button"
                variant={filtroRapido === "todos" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroRapido("todos")}
                className="h-7 text-xs px-2.5"
              >
                Todos
              </Button>
              <Button
                type="button"
                variant={filtroRapido === "activos" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroRapido("activos")}
                className="h-7 text-xs px-2.5"
              >
                Activos
              </Button>
              <Button
                type="button"
                variant={filtroRapido === "pasivos" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroRapido("pasivos")}
                className="h-7 text-xs px-2.5"
              >
                Pasivos / Jubilados
              </Button>
              <Button
                type="button"
                variant={filtroRapido === "sin_carnet" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroRapido("sin_carnet")}
                className="h-7 text-xs px-2.5"
              >
                Sin carnet activo
              </Button>
            </div>

            {/* Desplegable de Resultados de Búsqueda cuando no hay selección fija */}
            {!trabajadorSeleccionado && debouncedQuery.length >= 2 && (
              <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-border bg-card">
                {isLoadingBusqueda && (
                  <div className="flex items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Buscando en GATH…
                  </div>
                )}

                {!isLoadingBusqueda && resultadosFiltrados.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No se encontraron trabajadores que coincidan con «{debouncedQuery}».
                  </div>
                )}

                {!isLoadingBusqueda &&
                  resultadosFiltrados.map((emp) => (
                    <button
                      key={emp.cedula}
                      type="button"
                      onClick={() => handleSeleccionarTrabajador(emp)}
                      className="group flex w-full items-center justify-between gap-4 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                          <User className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {emp.nombre_completo}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            C.I. V-{emp.cedula}
                            {emp.cargo ? ` · ${emp.cargo}` : " · Sin cargo registrado"}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <Badge
                          variant="outline"
                          className={
                            emp.tiene_carnet
                              ? "border-success/30 bg-success-soft text-success"
                              : "border-border text-muted-foreground"
                          }
                        >
                          {emp.tiene_carnet ? "Carnet activo" : "Sin carnet"}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                          Seleccionar
                          <ArrowRight
                            className="size-4 transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Área Principal de Operación: Titular Seleccionado + Vista Previa */}
        {trabajadorSeleccionado ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna Izquierda: Datos del Titular y Parámetros de Emisión (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Tarjeta de Identidad del Titular (Sin inputs grises de solo lectura) */}
              <Card className="border-border/60 shadow-sm bg-card">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="size-14 sm:size-16 rounded-xl bg-muted border-2 border-primary overflow-hidden flex items-center justify-center shrink-0">
                        <User className="size-8 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                            {trabajadorSeleccionado.nombre_completo.toUpperCase()}
                          </h3>
                          <Badge variant="default" className="text-[10px] font-bold">
                            {trabajadorSeleccionado.cargo?.toLowerCase().includes("jubilad") ? "PASIVO" : "ACTIVO"}
                          </Badge>
                        </div>
                        <p className="text-xs font-semibold text-primary mt-0.5">
                          C.I. V-{trabajadorSeleccionado.cedula}
                          {trabajadorSeleccionado.codigo ? ` · Cód. ${trabajadorSeleccionado.codigo}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {trabajadorSeleccionado.cargo || "Cargo no especificado"}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLimpiarSeleccion}
                      className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
                      title="Cambiar de titular"
                    >
                      <RotateCw className="size-3.5 mr-1" />
                      Cambiar
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground block font-medium">Dependencia / Gerencia</span>
                      <span className="font-semibold text-foreground truncate block mt-0.5">
                        {trabajadorSeleccionado.departamento || "Dirección General CONATEL"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground block font-medium">Tipo de Nómina</span>
                      <span className="font-semibold text-foreground truncate block mt-0.5">
                        {trabajadorSeleccionado.cargo?.toLowerCase().includes("jubilad")
                          ? "Personal Jubilado / Pensionado"
                          : "Empleado Fijo Institucional"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground block font-medium">Estado del Carnet Actual</span>
                      <span className="inline-flex items-center gap-1.5 font-semibold mt-0.5">
                        {trabajadorSeleccionado.tiene_carnet ? (
                          <>
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-emerald-600 dark:text-emerald-400">Activo y Vigente</span>
                          </>
                        ) : (
                          <>
                            <span className="size-2 rounded-full bg-amber-500" />
                            <span className="text-amber-600 dark:text-amber-400">Sin carnet vigente emitido</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/40">
                      <span className="text-muted-foreground block font-medium">Historial de Emisiones</span>
                      <span className="font-semibold text-foreground block mt-0.5">
                        {trabajadorSeleccionado.total_solicitudes
                          ? `${trabajadorSeleccionado.total_solicitudes} emisión(es) previa(s)`
                          : "Primera emisión oficial"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Formulario de Emisión Simple (2 clics) */}
              <Card className="border-border/60 shadow-sm bg-card">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Printer className="size-4 text-primary" />
                    Parámetros de Emisión Oficial
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="motivo-emision" className="text-xs font-semibold">
                        Motivo de Emisión *
                      </Label>
                      <Select
                        value={String(motivoEfectivoId)}
                        onValueChange={(val) => setMotivoId(Number(val))}
                      >
                        <SelectTrigger id="motivo-emision" className="h-10 mt-1 text-xs">
                          <SelectValue placeholder="Seleccione motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          {listaMotivos && listaMotivos.length > 0 ? (
                            listaMotivos.map((m) => (
                              <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                                {m.nombre.toUpperCase()}
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="1" className="text-xs">
                                EMISIÓN POR PRIMERA VEZ
                              </SelectItem>
                              <SelectItem value="2" className="text-xs">
                                RENOVACIÓN POR VENCIMIENTO
                              </SelectItem>
                              <SelectItem value="3" className="text-xs">
                                EXTRAVÍO O PÉRDIDA
                              </SelectItem>
                              <SelectItem value="4" className="text-xs">
                                DETERIORO O DAÑO FÍSICO
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="plantilla-emision" className="text-xs font-semibold">
                        Plantilla del PDF
                      </Label>
                      <Select value={plantillaId} onValueChange={setPlantillaId}>
                        <SelectTrigger id="plantilla-emision" className="mt-1 h-10 text-sm">
                          <SelectValue placeholder="Plantilla activa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="activa">Plantilla activa del sistema</SelectItem>
                          {plantillasLegacy?.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.nombre}
                              {p.activo ? "" : " (inactiva)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        La vista previa usa la plantilla activa. El PDF se emite con la plantilla
                        elegida aquí.
                      </p>
                    </div>
                  </div>

                  {tieneCarnetVigente && (
                    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-700/60 dark:bg-amber-950/20">
                      <p
                        role="alert"
                        className="flex items-start gap-2 text-xs font-medium text-amber-800 dark:text-amber-300"
                      >
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>
                          Ya tiene un carnet vigente emitido el{" "}
                          {fechaCarnetVigente ?? "día registrado"}.
                        </span>
                      </p>

                      {avisoReemision && (
                        <p role="alert" className="text-xs text-destructive">
                          {avisoReemision}
                        </p>
                      )}

                      <div>
                        <Label htmlFor="motivo-reemision" className="text-xs font-semibold">
                          Motivo de la reemisión *
                        </Label>
                        <Select
                          value={motivoReemision}
                          onValueChange={(val) => {
                            setMotivoReemision(val);
                            if (val !== "OTRO") setDetalleReemision("");
                          }}
                        >
                          <SelectTrigger
                            id="motivo-reemision"
                            className="mt-1 h-10 text-xs"
                            aria-invalid={!motivoReemision}
                          >
                            <SelectValue placeholder="Seleccione el motivo" />
                          </SelectTrigger>
                          <SelectContent>
                            {MOTIVOS_REEMISION.map((opcion) => (
                              <SelectItem key={opcion.value} value={opcion.value} className="text-xs">
                                {opcion.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {requiereDetalleReemision && (
                        <div>
                          <Label htmlFor="detalle-reemision" className="text-xs font-semibold">
                            Detalle de la reemisión *
                          </Label>
                          <Textarea
                            id="detalle-reemision"
                            value={detalleReemision}
                            onChange={(e) => setDetalleReemision(e.target.value)}
                            placeholder="Explique brevemente el motivo (mínimo 10 caracteres)"
                            maxLength={300}
                            className="mt-1"
                            aria-invalid={
                              detalleReemision.trim().length < DETALLE_REEMISION_MIN
                            }
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {detalleReemision.trim().length}/{DETALLE_REEMISION_MIN} caracteres
                            mínimos
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="observaciones-emision" className="text-xs font-semibold">
                      Observaciones Administrativas
                    </Label>
                    <Textarea
                      id="observaciones-emision"
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Indique detalles de respaldo, entrega o código de trámite..."
                      maxLength={300}
                      className="mt-1"
                    />
                  </div>

                  {/* Advertencia y Botones de Emisión */}
                  <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-border/50">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
                      Se invalidará automáticamente cualquier credencial previa emitida.
                    </p>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleActualizarPreview}
                        disabled={generandoPreview || isPendingEmision}
                        className="text-xs min-h-11 px-3"
                      >
                        {generandoPreview ? (
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Eye className="size-3.5 mr-1.5" />
                        )}
                        {generandoPreview ? "Generando vista previa…" : "Refrescar Vista"}
                      </Button>

                      <Button
                        type="button"
                        onClick={handleEmitirCarnet}
                        disabled={
                          isPendingEmision || generandoPreview || !motivoEfectivoId || !reemisionCompleta
                        }
                        className="text-xs font-semibold min-h-11 px-5 shadow-sm"
                      >
                        {isPendingEmision ? (
                          <>
                            <Loader2 className="size-4 animate-spin mr-2" />
                            Emitiendo…
                          </>
                        ) : (
                          <>
                            <Printer className="size-4 mr-2" />
                            Emitir y Descargar PDF
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Columna Derecha: Vista Previa Oficial (CR80 · 54x85.6 mm) (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-border/60 shadow-sm bg-card flex flex-col items-center">
                <CardHeader className="w-full pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Vista Previa Oficial
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Estándar CR80 (54 × 85.6 mm)
                    </CardDescription>
                  </div>

                  {/* Toggle Anverso / Reverso */}
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                    <Button
                      type="button"
                      size="sm"
                      variant={caraPreview === "anverso" ? "default" : "ghost"}
                      onClick={() => setCaraPreview("anverso")}
                      className="h-7 text-xs px-2.5 font-medium"
                    >
                      Anverso
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={caraPreview === "reverso" ? "default" : "ghost"}
                      onClick={() => setCaraPreview("reverso")}
                      className="h-7 text-xs px-2.5 font-medium"
                    >
                      Reverso
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 pb-6 flex flex-col items-center w-full">
                  {caraPreview === "anverso" && vistaPreviaRaster ? (
                    /* La vista previa raster del backend ya contiene la plantilla, la foto y los
                       datos con las proporciones reales del carnet. */
                    <div className="w-[240px] h-[380px] overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={vistaPreviaRaster}
                        alt={`Vista previa del carnet de ${trabajadorSeleccionado.nombre_completo}`}
                        className="size-full object-contain"
                      />
                    </div>
                  ) : (
                    /* Tarjeta de Carnet Fiel (Renderizado vector/raster con alta fidelidad) */
                    <div
                      className="w-[240px] h-[380px] bg-white rounded-xl shadow-xl border border-slate-300 relative overflow-hidden flex flex-col transition-all duration-300 select-none text-slate-900"
                      aria-label={`Vista previa del carnet: ${caraPreview}`}
                    >
                      {caraPreview === "anverso" ? (
                        <>
                          {/* Franja Superior Institucional Azul Marino CONATEL */}
                          <div className="h-14 bg-[#001f3f] relative flex items-center px-3 justify-between overflow-hidden">
                            <div className="z-10">
                              <span className="text-[10px] font-black text-white tracking-widest block leading-tight">
                                CONATEL
                              </span>
                              <span className="text-[6px] text-slate-200 tracking-wider block uppercase">
                                República Bolivariana de Venezuela
                              </span>
                            </div>
                            {/* Acento dorado angular */}
                            <div className="h-full w-8 bg-[#ffd700] skew-x-[-20deg] absolute right-4 top-0 opacity-80" />
                          </div>

                          {/* Cuerpo Anverso */}
                          <div className="flex-1 flex flex-col items-center pt-2.5 px-3 text-center">
                            {/* Marco de Foto */}
                            <div className="size-20 rounded-lg bg-slate-100 border-2 border-[#001f3f] overflow-hidden mb-2 shadow-inner flex items-center justify-center">
                              <User className="size-10 text-slate-400" />
                            </div>

                            {/* Nombre */}
                            <h4 className="text-[11px] font-black text-slate-900 leading-tight line-clamp-2 px-1">
                              {truncarNombre(trabajadorSeleccionado.nombre_completo).toUpperCase()}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-700 mt-0.5">
                              C.I. V-{trabajadorSeleccionado.cedula}
                            </p>
                            <p className="text-[9px] font-medium text-slate-600 mt-0.5 line-clamp-1">
                              {trabajadorSeleccionado.cargo || "FUNCIONARIO"}
                            </p>

                            {/* Línea divisoria dorada */}
                            <div className="w-3/4 h-0.5 bg-[#d4af37] my-1.5" />

                            <p className="text-[8px] text-slate-500 line-clamp-1">
                              {trabajadorSeleccionado.departamento || "Gerencia de Operaciones"}
                            </p>

                            {/* Pie de Anverso con QR y Vigencia */}
                            <div className="mt-auto mb-2 flex items-center justify-between w-full px-1">
                              <div className="size-8 bg-slate-50 border border-slate-300 p-0.5 rounded flex items-center justify-center">
                                <QrCode className="size-full text-slate-800" />
                              </div>
                              <div className="text-right">
                                <span className="text-[7px] text-slate-400 block font-medium">Vigencia</span>
                                <span className="text-[8px] font-bold text-slate-800">
                                  {new Date().getFullYear() + 2}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Franja Inferior Azul Marino */}
                          <div className="h-4 bg-[#001f3f]" />
                        </>
                      ) : (
                        <>
                          {/* Cara Reverso Oficial */}
                          <div className="h-10 bg-[#001f3f] flex items-center px-3 justify-center">
                            <span className="text-[9px] font-bold text-white tracking-wider">
                              CONDICIONES DE USO
                            </span>
                          </div>

                          <div className="flex-1 flex flex-col items-center p-3 text-center text-slate-800">
                            <p className="text-[7px] text-justify leading-tight text-slate-600 mb-2">
                              • Esta credencial es de uso estrictamente oficial, intransferible y personal.
                              <br />
                              • Debe portarse visible en todas las instalaciones de CONATEL.
                              <br />
                              • En caso de pérdida o extravío, notifique inmediatamente a Gestión Humana.
                              <br />• Válida únicamente con sello institucional y código QR activo.
                            </p>

                            <div className="size-20 bg-slate-50 border border-slate-300 p-1 rounded-lg flex items-center justify-center mb-1.5">
                              <QrCode className="size-full text-slate-900" />
                            </div>

                            <span className="text-[8px] font-bold text-slate-700">
                              Validación Criptográfica QR
                            </span>
                            <span className="text-[6.5px] text-slate-400">
                              Algoritmo SHA-256 Verificado
                            </span>

                            <div className="mt-auto border-t border-slate-300 w-36 pt-1 text-center">
                              <span className="text-[7px] text-slate-600 font-bold block">
                                Dirección General CONATEL
                              </span>
                              <span className="text-[6px] text-slate-400">Gestión Humana</span>
                            </div>
                          </div>

                          <div className="h-3 bg-[#001f3f]" />
                        </>
                      )}
                    </div>
                  )}

                  {(generandoPreview || isPendingEmision) && (
                    <p
                      role="status"
                      aria-live="polite"
                      className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-primary"
                    >
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      {isPendingEmision ? "Emitiendo…" : "Generando vista previa…"}
                    </p>
                  )}

                  <p className="text-[11px] text-muted-foreground mt-3 text-center">
                    Resolución: 300 DPI estándar para tarjetas de identificación PVC.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Estado Vacío cuando no hay trabajador seleccionado */
          <Card className="border-border/60 shadow-sm bg-card">
            <CardContent className="text-center py-16 space-y-3">
              <div className="size-16 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mx-auto text-muted-foreground">
                <IdCard className="size-8" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Ningún titular seleccionado
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Ingrese la cédula, nombres o código de cargo en la barra superior para localizar al
                trabajador y proceder con la emisión oficial de su credencial.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
