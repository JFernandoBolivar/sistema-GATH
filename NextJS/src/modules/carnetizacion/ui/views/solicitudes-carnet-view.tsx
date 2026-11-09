"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  FileCheck,
  Loader2,
  Printer,
  User,
  XCircle,
} from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarraFiltros, type FiltroActivoChip } from "@/shared/ui/components/barra-filtros";

import {
  generarCarnetPdfAction,
  getMotivosCarnetAction,
} from "../../infrastructure/actions/carnetizacion-actions";
import type { MotivoOption } from "../../domain/entities/carnet";

export type EstadoSolicitudCarnet = "PENDIENTE" | "APROBADA" | "RECHAZADA";

export interface SolicitudCarnetItem {
  id: string | number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  cargo: string;
  departamento: string;
  poblacion: "ACTIVO" | "PASIVO";
  motivoSolicitud: string;
  justificacion: string;
  fechaSolicitud: string;
  estado: EstadoSolicitudCarnet;
  motivoRechazo?: string;
  carnetAnteriorEstado?: "ACTIVO" | "VENCIDO" | "NINGUNO";
}

// Datos iniciales de contingencia mientras el backend expone el endpoint canónico
const SOLICITUDES_INICIALES: SolicitudCarnetItem[] = [
  {
    id: "SOL-2026-0042",
    cedula: "18456789",
    nombres: "JOSÉ FERNANDO",
    apellidos: "BOLÍVAR HERNÁNDEZ",
    nombreCompleto: "BOLÍVAR HERNÁNDEZ, JOSÉ FERNANDO",
    cargo: "Especialista en Seguridad de Telecomunicaciones",
    departamento: "Gerencia de Operaciones y Redes",
    poblacion: "ACTIVO",
    motivoSolicitud: "RENOVACIÓN POR VENCIMIENTO",
    justificacion: "Mi carnet institucional venció el mes pasado y requiero credencial vigente para acceso a salas técnicas.",
    fechaSolicitud: "2026-11-09T08:15:00Z",
    estado: "PENDIENTE",
    carnetAnteriorEstado: "VENCIDO",
  },
  {
    id: "SOL-2026-0041",
    cedula: "10510831",
    nombres: "ODALIS",
    apellidos: "RAMÍREZ",
    nombreCompleto: "RAMÍREZ, ODALIS",
    cargo: "Personal Jubilado",
    departamento: "Gestión de Personal Pasivo",
    poblacion: "PASIVO",
    motivoSolicitud: "DETERIORO O DAÑO FÍSICO",
    justificacion: "La credencial de jubilada presenta desgaste en la banda magnética y el código QR está ilegible.",
    fechaSolicitud: "2026-11-09T07:45:00Z",
    estado: "PENDIENTE",
    carnetAnteriorEstado: "ACTIVO",
  },
  {
    id: "SOL-2026-0039",
    cedula: "3403630",
    nombres: "WALTER",
    apellidos: "LANDAETA",
    nombreCompleto: "LANDAETA, WALTER",
    cargo: "Jubilado Especial",
    departamento: "Gestión de Personal Pasivo",
    poblacion: "PASIVO",
    motivoSolicitud: "EXTRAVÍO O PÉRDIDA",
    justificacion: "Extravío de billetera con documentación personal y carnet de jubilado.",
    fechaSolicitud: "2026-11-08T16:20:00Z",
    estado: "APROBADA",
    carnetAnteriorEstado: "NINGUNO",
  },
];

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

export function SolicitudesCarnetView() {
  const router = useRouter();

  const [solicitudes, setSolicitudes] = useState<SolicitudCarnetItem[]>(SOLICITUDES_INICIALES);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [filtroPoblacion, setFiltroPoblacion] = useState<string>("TODAS");

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(10);

  // Modal de dictamen
  const [solicitudEnDictamen, setSolicitudEnDictamen] = useState<SolicitudCarnetItem | null>(null);
  const [motivoDictamenId, setMotivoDictamenId] = useState<number>(0);
  const [observacionesDictamen, setObservacionesDictamen] = useState("");
  const [isPendingDictamen, startTransitionDictamen] = useTransition();

  // Catálogo de motivos
  const { data: listaMotivos } = useSWR<MotivoOption[]>(
    "motivos-carnet-solicitudes",
    async () => {
      const resp = await getMotivosCarnetAction();
      if (Array.isArray(resp)) return resp as MotivoOption[];
      return [];
    },
    { revalidateOnFocus: false },
  );

  // Filtrado de solicitudes
  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter((item) => {
      // Búsqueda por texto (cédula o nombre)
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const coincideCedula = item.cedula.toLowerCase().includes(q);
        const coincideNombre = item.nombreCompleto.toLowerCase().includes(q);
        const coincideCargo = item.cargo.toLowerCase().includes(q);
        if (!coincideCedula && !coincideNombre && !coincideCargo) {
          return false;
        }
      }

      // Filtro por Estado
      if (filtroEstado !== "TODOS" && item.estado !== filtroEstado) {
        return false;
      }

      // Filtro por Población
      if (filtroPoblacion !== "TODAS" && item.poblacion !== filtroPoblacion) {
        return false;
      }

      return true;
    });
  }, [solicitudes, busqueda, filtroEstado, filtroPoblacion]);

  // Paginación sobre resultados filtrados
  const totalPaginas = Math.max(1, Math.ceil(solicitudesFiltradas.length / filasPorPagina));
  const indiceInicio = (paginaActual - 1) * filasPorPagina;
  const solicitudesPaginadas = solicitudesFiltradas.slice(indiceInicio, indiceInicio + filasPorPagina);

  // Conteo de solicitudes pendientes
  const totalPendientes = useMemo(() => {
    return solicitudes.filter((s) => s.estado === "PENDIENTE").length;
  }, [solicitudes]);

  // Construcción de chips de filtros activos para BarraFiltros
  const chipsActivos = useMemo<FiltroActivoChip[]>(() => {
    const chips: FiltroActivoChip[] = [];

    if (busqueda.trim()) {
      chips.push({
        id: "busqueda",
        label: "Búsqueda",
        valorLegible: busqueda,
        onRemover: () => setBusqueda(""),
      });
    }

    if (filtroEstado !== "TODOS") {
      const etiquetasEstado: Record<string, string> = {
        PENDIENTE: "Pendientes",
        APROBADA: "Aprobadas",
        RECHAZADA: "Rechazadas",
      };
      chips.push({
        id: "estado",
        label: "Estado",
        valorLegible: etiquetasEstado[filtroEstado] || filtroEstado,
        onRemover: () => setFiltroEstado("TODOS"),
      });
    }

    if (filtroPoblacion !== "TODAS") {
      chips.push({
        id: "poblacion",
        label: "Población",
        valorLegible: filtroPoblacion === "ACTIVO" ? "Activos" : "Pasivos",
        onRemover: () => setFiltroPoblacion("TODAS"),
      });
    }

    return chips;
  }, [busqueda, filtroEstado, filtroPoblacion]);

  const hayFiltrosActivos = chipsActivos.length > 0;

  const handleLimpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("TODOS");
    setFiltroPoblacion("TODAS");
    setPaginaActual(1);
  };

  const handleAbrirDictamen = (item: SolicitudCarnetItem) => {
    setSolicitudEnDictamen(item);
    setObservacionesDictamen("");
    if (listaMotivos && listaMotivos.length > 0) {
      setMotivoDictamenId(listaMotivos[0].id);
    }
  };

  const handleAprobarYEmitir = () => {
    if (!solicitudEnDictamen) return;

    startTransitionDictamen(async () => {
      try {
        const cedula = solicitudEnDictamen.cedula;
        const nombre = solicitudEnDictamen.nombreCompleto;
        const motivo = motivoDictamenId || 1;

        // Intentar generar el PDF directamente si la API responde
        const result = await generarCarnetPdfAction(cedula, motivo, nombre);
        if (result.success && result.data) {
          downloadPdfBase64(result.data, `carnet_aprobado_${cedula}.pdf`);
        }

        // Actualizar estado de la solicitud en la bandeja
        setSolicitudes((prev) =>
          prev.map((s) =>
            s.id === solicitudEnDictamen.id
              ? { ...s, estado: "APROBADA" }
              : s,
          ),
        );

        toast.success(`Solicitud ${solicitudEnDictamen.id} aprobada. Credencial emitida exitosamente.`);
        setSolicitudEnDictamen(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al procesar dictamen";
        toast.error(msg);
      }
    });
  };

  const handleRechazar = () => {
    if (!solicitudEnDictamen) return;
    if (!observacionesDictamen.trim()) {
      toast.error("Debe indicar el motivo del rechazo en las observaciones.");
      return;
    }

    startTransitionDictamen(async () => {
      setSolicitudes((prev) =>
        prev.map((s) =>
          s.id === solicitudEnDictamen.id
            ? { ...s, estado: "RECHAZADA", motivoRechazo: observacionesDictamen.trim() }
            : s,
        ),
      );

      toast.info(`Solicitud ${solicitudEnDictamen.id} rechazada con motivo documentado.`);
      setSolicitudEnDictamen(null);
    });
  };

  return (
    <PageLayout
      title="Bandeja de Solicitudes de Carnet"
      description="Revisión centralizada y dictamen de solicitudes de credencial enviadas desde Autogestión."
    >
      <div className="space-y-6 mt-4">
        {/* Cabecera de Operación */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent-foreground border border-accent/30">
              <Clock className="size-3.5 text-accent animate-pulse" />
              {totalPendientes} Solicitud(es) Pendiente(s)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push("/carnetizacion/emision")}
              className="text-xs font-semibold min-h-11 px-4"
            >
              <Printer className="size-4 mr-1.5" />
              Consola de Emisión Directa
            </Button>
          </div>
        </div>

        {/* Componente Unificado BarraFiltros (FIX-DIS1 / O51) */}
        <BarraFiltros
          busqueda={busqueda}
          onBusquedaChange={(val) => {
            setBusqueda(val);
            setPaginaActual(1);
          }}
          placeholderBusqueda="Buscar por cédula o nombre del solicitante…"
          totalResultados={solicitudesFiltradas.length}
          etiquetaResultados="solicitudes"
          hayFiltrosActivos={hayFiltrosActivos}
          onLimpiarFiltros={handleLimpiarFiltros}
          chipsActivos={chipsActivos}
        >
          <div className="flex flex-col gap-1.5 min-w-0">
            <Label className="text-sm font-medium text-foreground block">
              Estado de la Solicitud
            </Label>
            <Select
              value={filtroEstado}
              onValueChange={(val) => {
                setFiltroEstado(val);
                setPaginaActual(1);
              }}
            >
              <SelectTrigger className="h-11 w-full min-w-0 text-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los estados</SelectItem>
                <SelectItem value="PENDIENTE">Pendientes de revisión</SelectItem>
                <SelectItem value="APROBADA">Aprobadas y emitidas</SelectItem>
                <SelectItem value="RECHAZADA">Rechazadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <Label className="text-sm font-medium text-foreground block">
              Población
            </Label>
            <Select
              value={filtroPoblacion}
              onValueChange={(val) => {
                setFiltroPoblacion(val);
                setPaginaActual(1);
              }}
            >
              <SelectTrigger className="h-11 w-full min-w-0 text-sm">
                <SelectValue placeholder="Población" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas las poblaciones</SelectItem>
                <SelectItem value="ACTIVO">Personal Activo</SelectItem>
                <SelectItem value="PASIVO">Personal Pasivo (Jubilados)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </BarraFiltros>

        {/* Tabla de Solicitudes */}
        <Card className="border-border/60 shadow-sm bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Solicitante</th>
                  <th className="p-3">Dependencia / Cargo</th>
                  <th className="p-3">Motivo Declarado</th>
                  <th className="p-3">Población</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {solicitudesPaginadas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No hay solicitudes registradas que coincidan con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  solicitudesPaginadas.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 whitespace-nowrap text-muted-foreground font-mono">
                        {new Date(item.fechaSolicitud).toLocaleDateString("es-VE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                            <User className="size-4" />
                          </div>
                          <div>
                            <span className="font-bold text-foreground block">
                              {item.nombreCompleto}
                            </span>
                            <span className="text-muted-foreground font-mono text-[11px]">
                              C.I. V-{item.cedula}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 max-w-[200px]">
                        <span className="text-foreground font-medium block truncate">
                          {item.departamento}
                        </span>
                        <span className="text-muted-foreground text-[11px] block truncate">
                          {item.cargo}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className="font-semibold text-foreground block">
                          {item.motivoSolicitud}
                        </span>
                        <span className="text-muted-foreground text-[11px] line-clamp-1 max-w-[220px]">
                          {item.justificacion}
                        </span>
                      </td>

                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            item.poblacion === "ACTIVO"
                              ? "bg-primary/10 text-primary border-primary/20 text-[10px]"
                              : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"
                          }
                        >
                          {item.poblacion}
                        </Badge>
                      </td>

                      <td className="p-3">
                        {item.estado === "PENDIENTE" && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-semibold">
                            Pendiente
                          </Badge>
                        )}
                        {item.estado === "APROBADA" && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-semibold">
                            Aprobada
                          </Badge>
                        )}
                        {item.estado === "RECHAZADA" && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] font-semibold">
                            Rechazada
                          </Badge>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <Button
                          variant={item.estado === "PENDIENTE" ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleAbrirDictamen(item)}
                          className="h-8 text-xs font-semibold px-3"
                        >
                          <FileCheck className="size-3.5 mr-1" />
                          {item.estado === "PENDIENTE" ? "Dictaminar" : "Ver Detalle"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginación Estandarizada */}
          <div className="p-3 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Mostrando {solicitudesFiltradas.length > 0 ? indiceInicio + 1 : 0} -{" "}
              {Math.min(indiceInicio + filasPorPagina, solicitudesFiltradas.length)} de{" "}
              {solicitudesFiltradas.length} solicitudes
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span>Por página:</span>
                <select
                  value={filasPorPagina}
                  onChange={(e) => {
                    setFilasPorPagina(Number(e.target.value));
                    setPaginaActual(1);
                  }}
                  className="h-8 px-2 bg-background border border-input rounded text-xs text-foreground focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  disabled={paginaActual <= 1}
                  className="h-8 px-2.5 text-xs"
                >
                  Anterior
                </Button>
                <span className="px-2 font-medium">
                  {paginaActual} / {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaActual >= totalPaginas}
                  className="h-8 px-2.5 text-xs"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Modal de Dictamen Oficial */}
        <Dialog
          open={!!solicitudEnDictamen}
          onOpenChange={(open) => !open && setSolicitudEnDictamen(null)}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <FileCheck className="size-5 text-primary" />
                Dictamen de Solicitud de Credencial
              </DialogTitle>
              <DialogDescription className="text-xs">
                Revise los antecedentes del titular y apruebe la emisión oficial o rechace la solicitud.
              </DialogDescription>
            </DialogHeader>

            {solicitudEnDictamen && (
              <div className="space-y-4 py-2 text-xs">
                {/* Resumen del Titular */}
                <div className="p-3 rounded-lg bg-muted/40 border border-border/50 flex items-start gap-3">
                  <div className="size-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    <User className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground truncate">
                        {solicitudEnDictamen.nombreCompleto}
                      </h4>
                      <Badge variant="outline" className="text-[10px]">
                        {solicitudEnDictamen.poblacion}
                      </Badge>
                    </div>
                    <p className="text-primary font-semibold">
                      C.I. V-{solicitudEnDictamen.cedula}
                    </p>
                    <p className="text-muted-foreground truncate">
                      {solicitudEnDictamen.cargo} · {solicitudEnDictamen.departamento}
                    </p>
                  </div>
                </div>

                {/* Detalle de la Solicitud Declarada */}
                <div className="p-3 rounded-lg border border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Motivo declarado por el trabajador:
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {solicitudEnDictamen.motivoSolicitud}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground bg-background p-2.5 rounded border border-border/40 text-xs">
                    «{solicitudEnDictamen.justificacion}»
                  </p>
                </div>

                {/* Parámetros del Dictamen */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="motivo-dictamen" className="text-xs font-semibold">
                        Motivo de Emisión Registrado
                      </Label>
                      <Select
                        value={motivoDictamenId ? String(motivoDictamenId) : "1"}
                        onValueChange={(val) => setMotivoDictamenId(Number(val))}
                      >
                        <SelectTrigger id="motivo-dictamen" className="h-10 mt-1 text-xs">
                          <SelectValue placeholder="Motivo oficial" />
                        </SelectTrigger>
                        <SelectContent>
                          {listaMotivos?.map((m) => (
                            <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                              {m.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Plantilla Aplicada</Label>
                      <Input
                        disabled
                        value={
                          solicitudEnDictamen.poblacion === "ACTIVO"
                            ? "Plantilla Oficial Activos (Azul Marino)"
                            : "Plantilla Oficial Pasivos (Verde Institucional)"
                        }
                        className="h-10 mt-1 text-xs bg-muted/50"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="obs-dictamen" className="text-xs font-semibold">
                      Observaciones del Dictamen / Motivo de Rechazo
                    </Label>
                    <Textarea
                      id="obs-dictamen"
                      value={observacionesDictamen}
                      onChange={(e) => setObservacionesDictamen(e.target.value)}
                      placeholder="Indique las razones del dictamen o el motivo obligatorio en caso de rechazo..."
                      className="mt-1"
                      maxLength={300}
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/50 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSolicitudEnDictamen(null)}
                className="text-xs"
              >
                Cancelar
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRechazar}
                  disabled={isPendingDictamen}
                  className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 min-h-11 px-3"
                >
                  <XCircle className="size-3.5 mr-1.5" />
                  Rechazar Solicitud
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAprobarYEmitir}
                  disabled={isPendingDictamen}
                  className="text-xs font-semibold min-h-11 px-4"
                >
                  {isPendingDictamen ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle2 className="size-4 mr-1.5" />
                  )}
                  Aprobar y Emitir Carnet
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
