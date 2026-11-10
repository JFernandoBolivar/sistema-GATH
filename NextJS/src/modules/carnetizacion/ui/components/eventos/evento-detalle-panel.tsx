"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Download,
  IdCard,
  Mail,
  MapPin,
  Plus,
  Printer,
  QrCode,
  RotateCw,
  Search,
  Settings,
  Square,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Button } from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import { Input } from "@/shared/ui/components/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/components/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import {
  crearCategoriaEventoAction,
  crearZonaEventoAction,
  emitirCredencialesLoteAction,
  enviarCredencialesCorreoAction,
  getCategoriasEventoAction,
  getEventoDetalleAction,
  getInvitadosEventoAction,
  getPanelEventoAction,
  getZonasEventoAction,
} from "@/modules/carnetizacion/infrastructure/actions/eventos-actions";
import type {
  Evento,
  EventoCategoria,
  EventoInvitado,
  EventoZona,
  PanelEvento,
} from "@/modules/carnetizacion/domain/entities/evento";
import { InvitadoCrearDialog } from "./invitado-crear-dialog";
import { InvitadosImportarDialog } from "./invitados-importar-dialog";
import { ControlEntradaQrView } from "./control-entrada-qr-view";

interface EventoDetallePanelProps {
  eventoId: string;
}

export function EventoDetallePanel({ eventoId }: EventoDetallePanelProps) {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [panel, setPanel] = useState<PanelEvento | null>(null);
  const [invitados, setInvitados] = useState<EventoInvitado[]>([]);
  const [categorias, setCategorias] = useState<EventoCategoria[]>([]);
  const [zonas, setZonas] = useState<EventoZona[]>([]);

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<string>("resumen");

  // Filtros de invitados
  const [busqueda, setBusqueda] = useState("");
  const [catFiltro, setCatFiltro] = useState<string>("todas");
  const [zonaFiltro, setZonaFiltro] = useState<string>("todas");

  // Paginación en servidor / cliente (10 por defecto)
  const [paginaActual, setPaginaActual] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(10);

  // Selección masiva de invitados para emisión por lotes
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Diálogos modales
  const [openCrearInvitado, setOpenCrearInvitado] = useState(false);
  const [openImportarInvitados, setOpenImportarInvitados] = useState(false);

  // Estados de configuración de nueva categoría y zona
  const [nuevaCatNombre, setNuevaCatNombre] = useState("");
  const [nuevaCatColor, setNuevaCatColor] = useState("#001f3f");
  const [nuevaZonaNombre, setNuevaZonaNombre] = useState("");
  const [nuevaZonaCodigo, setNuevaZonaCodigo] = useState("");

  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const cargarDatos = useCallback(() => {
    startTransition(async () => {
      try {
        const [ev, p, invs, cats, zns] = await Promise.all([
          getEventoDetalleAction(eventoId),
          getPanelEventoAction(eventoId),
          getInvitadosEventoAction(eventoId),
          getCategoriasEventoAction(eventoId),
          getZonasEventoAction(eventoId),
        ]);
        setEvento(ev);
        setPanel(p);
        setInvitados(invs);
        setCategorias(cats);
        setZonas(zns);
      } catch (err) {
        console.error("Error cargando panel de evento:", err);
      }
    });
  }, [eventoId]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Filtrado de invitados
  const invitadosFiltrados = useMemo(() => {
    return invitados.filter((inv) => {
      const matchBusqueda =
        !busqueda ||
        inv.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
        (inv.documento_identidad && inv.documento_identidad.toLowerCase().includes(busqueda.toLowerCase())) ||
        (inv.codigo_credencial && inv.codigo_credencial.toLowerCase().includes(busqueda.toLowerCase())) ||
        (inv.organizacion && inv.organizacion.toLowerCase().includes(busqueda.toLowerCase()));

      const matchCat = catFiltro === "todas" || inv.categoria_id === catFiltro;
      const matchZona = zonaFiltro === "todas" || inv.zona_id === zonaFiltro;

      return matchBusqueda && matchCat && matchZona;
    });
  }, [invitados, busqueda, catFiltro, zonaFiltro]);

  // Paginación
  const totalPaginas = Math.max(1, Math.ceil(invitadosFiltrados.length / filasPorPagina));
  const indiceInicio = (paginaActual - 1) * filasPorPagina;
  const invitadosPaginados = invitadosFiltrados.slice(indiceInicio, indiceInicio + filasPorPagina);

  // Selección masiva
  const estanTodosDePaginaSeleccionados =
    invitadosPaginados.length > 0 &&
    invitadosPaginados.every((inv) => selectedIds.has(inv.id));

  const toggleSeleccionarPagina = () => {
    setSelectedIds((prev) => {
      const nuevo = new Set(prev);
      if (estanTodosDePaginaSeleccionados) {
        invitadosPaginados.forEach((inv) => nuevo.delete(inv.id));
      } else {
        invitadosPaginados.forEach((inv) => nuevo.add(inv.id));
      }
      return nuevo;
    });
  };

  const seleccionarTodosLosFiltrados = () => {
    setSelectedIds(new Set(invitadosFiltrados.map((inv) => inv.id)));
  };

  const limpiarSeleccion = () => {
    setSelectedIds(new Set());
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  // Acciones de Emisión en Lote y Correo
  const handleEmitirLote = async () => {
    try {
      setErrorAccion(null);
      setMensaje("Emitiendo credenciales de gafete en lote…");
      const idsAEnviar = selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
      const res = await emitirCredencialesLoteAction(eventoId, idsAEnviar);
      setMensaje(`Emisión exitosa: ${res.total_emitidos} credenciales generadas.`);
      cargarDatos();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "Error al emitir gafetes en lote");
    }
  };

  const handleEnviarCorreo = async () => {
    try {
      setErrorAccion(null);
      setMensaje("Enviando gafetes digitales por correo electrónico…");
      const res = await enviarCredencialesCorreoAction(eventoId);
      setMensaje(`Envío finalizado: ${res.total_enviados} credenciales enviadas.`);
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "Error al enviar correos");
    }
  };

  const handleCrearCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCatNombre.trim()) return;
    try {
      await crearCategoriaEventoAction(eventoId, {
        nombre: nuevaCatNombre.trim(),
        color_primario: nuevaCatColor,
      });
      setNuevaCatNombre("");
      setMensaje("Categoría agregada exitosamente.");
      cargarDatos();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "Error al crear categoría");
    }
  };

  const handleCrearZona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaZonaNombre.trim()) return;
    try {
      await crearZonaEventoAction(eventoId, {
        nombre: nuevaZonaNombre.trim(),
        codigo: nuevaZonaCodigo.trim() || undefined,
      });
      setNuevaZonaNombre("");
      setNuevaZonaCodigo("");
      setMensaje("Zona / Puerta agregada exitosamente.");
      cargarDatos();
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "Error al crear zona");
    }
  };

  if (!evento && isPending) {
    return (
      <PageLayout title="Hub del Evento">
        <div className="p-16 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <RotateCw className="size-4 animate-spin text-primary" />
          Cargando datos del evento institucional…
        </div>
      </PageLayout>
    );
  }

  if (!evento) {
    return (
      <PageLayout title="Hub del Evento">
        <Card className="p-12 text-center border-dashed">
          <CardTitle className="text-base text-destructive">Evento no encontrado</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            El identificador proporcionado no corresponde a ningún evento registrado.
          </CardDescription>
          <Link href="/carnetizacion/eventos">
            <Button variant="outline" className="mt-4 text-xs font-semibold">
              <ArrowLeft className="size-3.5 mr-1.5" />
              Volver a la Lista de Eventos
            </Button>
          </Link>
        </Card>
      </PageLayout>
    );
  }

  // Primer invitado seleccionado o de ejemplo para la vista previa del gafete
  const invitadoParaPreview =
    invitados.find((inv) => selectedIds.has(inv.id)) || invitados[0];

  return (
    <PageLayout
      title={evento.nombre}
      description={`Hub Integral del Evento · Lugar: ${evento.lugar || "Sede CONATEL"} · Gestión centralizada sin pantallas intermedias.`}
    >
      <div className="space-y-6 mt-4">
        {/* Cabecera Principal con Navegación y Accesos Rápidos */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 rounded-xl border border-border/60 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/carnetizacion/eventos">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground px-2">
                  <ArrowLeft className="size-3.5 mr-1" />
                  Eventos
                </Button>
              </Link>
              <Badge
                variant="outline"
                className={
                  evento.estado === "ACTIVO"
                    ? "bg-success-soft text-success border-success/30 text-[10px] font-bold"
                    : "bg-muted text-muted-foreground border-border text-[10px] font-bold"
                }
              >
                {evento.estado}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1 font-medium">
                <MapPin className="size-3.5 text-primary" />
                {evento.lugar || "Sede CONATEL"}
              </span>

              {evento.fecha_inicio && (
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="size-3.5 text-primary" />
                  {new Date(evento.fecha_inicio).toLocaleDateString("es-VE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                  {evento.fecha_fin ? ` al ${new Date(evento.fecha_fin).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" })}` : ""}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={cargarDatos}
              className="text-xs font-semibold h-10 px-3"
              title="Refrescar métricas del evento"
            >
              <RotateCw className="size-3.5 mr-1" />
              Actualizar
            </Button>

            <a
              href={`/api/v1/carnetizacion/eventos/${evento.id}/pdf/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="text-xs font-semibold h-10 px-3">
                <Download className="size-3.5 mr-1.5" />
                PDF Gafetes (90×130)
              </Button>
            </a>

            <Button
              variant="default"
              size="sm"
              onClick={() => setActiveTab("control")}
              className="text-xs font-semibold h-10 px-4"
            >
              <QrCode className="size-4 mr-1.5" />
              Control en Puertas
            </Button>
          </div>
        </div>

        {/* Notificaciones y Avisos de Operación */}
        {mensaje && (
          <div className="p-3.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-lg flex justify-between items-center">
            <span>{mensaje}</span>
            <Button variant="ghost" size="sm" onClick={() => setMensaje(null)} className="h-6 w-6 p-0">
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        {errorAccion && (
          <div className="p-3.5 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg flex justify-between items-center">
            <span>{errorAccion}</span>
            <Button variant="ghost" size="sm" onClick={() => setErrorAccion(null)} className="h-6 w-6 p-0">
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Hub Integral: 5 Pestañas Estandarizadas (PRUEBAS-USUARIO §21e) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1 bg-muted/60 border border-border/60 rounded-xl gap-1">
            <TabsTrigger value="resumen" className="text-xs py-2.5 font-semibold">
              Resumen
            </TabsTrigger>
            <TabsTrigger value="invitados" className="text-xs py-2.5 font-semibold">
              Invitados ({invitados.length})
            </TabsTrigger>
            <TabsTrigger value="emision" className="text-xs py-2.5 font-semibold">
              Gafetes
            </TabsTrigger>
            <TabsTrigger value="control" className="text-xs py-2.5 font-semibold">
              Control
            </TabsTrigger>
            <TabsTrigger value="configuracion" className="text-xs py-2.5 font-semibold">
              Configuración
            </TabsTrigger>
          </TabsList>

          {/* ============================================================== */}
          {/* PESTAÑA 1: RESUMEN Y CIFRAS CANÓNICAS                         */}
          {/* ============================================================== */}
          <TabsContent value="resumen" className="space-y-6">
            {/* Banda de cifras y acciones (portada del evento) */}
            <Card className="border-border bg-card shadow-none">
              <CardContent className="space-y-5 p-5">
                <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Invitados</p>
                    <p className="mt-1 text-3xl font-bold text-foreground sm:text-4xl">
                      {panel?.total_invitados ?? invitados.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Aforo registrado</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Credenciales emitidas</p>
                    <p className="mt-1 text-3xl font-bold text-primary sm:text-4xl">
                      {panel?.credenciales_emitidas ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Con QR criptográfico</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Entraron</p>
                    <p className="mt-1 text-3xl font-bold text-success sm:text-4xl">
                      {panel?.entraron ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {panel?.porcentaje_asistencia ?? 0}% de asistencia
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Faltan</p>
                    <p className="mt-1 text-3xl font-bold text-warning sm:text-4xl">
                      {panel?.faltan ?? Math.max(0, (panel?.total_invitados ?? 0) - (panel?.entraron ?? 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">Pendientes en garita</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenImportarInvitados(true)}
                    className="min-h-10"
                  >
                    <UploadCloud className="size-4" aria-hidden />
                    Importar lista
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenCrearInvitado(true)}
                    className="min-h-10"
                  >
                    <Plus className="size-4" aria-hidden />
                    Agregar invitado
                  </Button>
                  <Button variant="outline" className="min-h-10" asChild>
                    <a
                      href={`/api/v1/carnetizacion/eventos/${evento.id}/pdf/`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Printer className="size-4" aria-hidden />
                      Imprimir en lote
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEnviarCorreo}
                    disabled={isPending}
                    className="min-h-10"
                  >
                    <Mail className="size-4" aria-hidden />
                    Enviar por correo
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {/* Vista rápida de la nómina */}
              <Card className="border-border bg-card shadow-none xl:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <CardTitle className="text-base font-semibold">Nómina de invitados</CardTitle>
                    <CardDescription>Primeros registros del evento.</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("invitados")}
                    className="min-h-9 shrink-0"
                  >
                    Ver toda la nómina
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="p-3 text-xs">Invitado</TableHead>
                          <TableHead className="p-3 text-xs">Categoría</TableHead>
                          <TableHead className="p-3 text-xs">Zona</TableHead>
                          <TableHead className="p-3 text-xs">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitados.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="p-6 text-center text-sm text-muted-foreground">
                              Aún no hay invitados registrados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          invitados.slice(0, 6).map((inv) => {
                            const ingreso = inv.estado === "ingreso";
                            const emitido =
                              ingreso ||
                              inv.estado === "emitido" ||
                              Boolean(inv.codigo_credencial || inv.fecha_emision);
                            return (
                              <TableRow key={inv.id} className="text-sm">
                                <TableCell className="p-3">
                                  <div className="font-medium text-foreground">{inv.nombre_completo}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {inv.documento_identidad ? `C.I. ${inv.documento_identidad}` : ""}
                                  </div>
                                </TableCell>
                                <TableCell className="p-3 text-muted-foreground">
                                  {inv.categoria_nombre || "General"}
                                </TableCell>
                                <TableCell className="p-3 text-muted-foreground">
                                  {inv.zona_nombre || "General"}
                                </TableCell>
                                <TableCell className="p-3">
                                  {ingreso ? (
                                    <Badge
                                      variant="outline"
                                      className="border-success/30 bg-success-soft text-success"
                                    >
                                      Entró
                                    </Badge>
                                  ) : emitido ? (
                                    <Badge variant="outline" className="border-primary/30 bg-secondary text-primary">
                                      Emitido
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                      Pendiente
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Ayuda de escaneo */}
              <Card className="border-border bg-card shadow-none">
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="text-base font-semibold">Al escanear en la entrada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 text-sm">
                  <div className="space-y-1">
                    <Badge variant="outline" className="border-success/30 bg-success-soft text-success">
                      Acceso permitido
                    </Badge>
                    <p className="text-muted-foreground">
                      Muestra nombre, categoría y zona, y registra la hora de ingreso.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
                      Ya ingresó
                    </Badge>
                    <p className="text-muted-foreground">
                      Avisa la hora de entrada para evitar credenciales copiadas.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Badge variant="outline" className="border-danger/30 bg-danger-soft text-danger">
                      No válida
                    </Badge>
                    <p className="text-muted-foreground">
                      Credencial anulada, vencida o de otro evento o zona.
                    </p>
                  </div>
                  <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                    Quien controla la entrada usa su teléfono con un permiso propio del evento.
                    El QR de un invitado deja de funcionar cuando termina el evento.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Desglose por Categorías y Zonas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border/60 bg-card shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Asistentes por Categoría
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  {categorias.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No hay categorías configuradas.</p>
                  ) : (
                    categorias.map((cat) => {
                      const conteo = invitados.filter((i) => i.categoria_id === cat.id).length;
                      return (
                        <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-3 rounded-full"
                              style={{ backgroundColor: cat.color_primario || "#001f3f" }}
                            />
                            <span className="font-semibold text-foreground">{cat.nombre}</span>
                          </div>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {conteo}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Aforo por Zonas y Puertas
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  {zonas.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No hay zonas configuradas.</p>
                  ) : (
                    zonas.map((z) => {
                      const conteo = invitados.filter((i) => i.zona_id === z.id).length;
                      return (
                        <div key={z.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs">
                          <span className="font-semibold text-foreground">{z.nombre}</span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {conteo} autorizados
                          </span>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============================================================== */}
          {/* PESTAÑA 2: NÓMINA DE INVITADOS CON PAGINACIÓN Y SELECCIÓN     */}
          {/* ============================================================== */}
          <TabsContent value="invitados" className="space-y-4">
            {/* Barra de Filtros y Búsqueda */}
            <Card className="border-border/60 shadow-xs bg-card">
              <CardContent className="p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Buscar por nombre, documento, código o institución..."
                      value={busqueda}
                      onChange={(e) => {
                        setBusqueda(e.target.value);
                        setPaginaActual(1);
                      }}
                      className="pl-9 h-10 text-xs bg-background border-input"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={catFiltro}
                      onValueChange={(val) => {
                        setCatFiltro(val);
                        setPaginaActual(1);
                      }}
                    >
                      <SelectTrigger className="h-10 text-xs w-[160px]">
                        <SelectValue placeholder="Categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas" className="text-xs">
                          Todas las categorías
                        </SelectItem>
                        {categorias.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={zonaFiltro}
                      onValueChange={(val) => {
                        setZonaFiltro(val);
                        setPaginaActual(1);
                      }}
                    >
                      <SelectTrigger className="h-10 text-xs w-[150px]">
                        <SelectValue placeholder="Zona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas" className="text-xs">
                          Todas las zonas
                        </SelectItem>
                        {zonas.map((z) => (
                          <SelectItem key={z.id} value={z.id} className="text-xs">
                            {z.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setOpenImportarInvitados(true)}
                      className="h-10 text-xs font-semibold px-3"
                    >
                      <UploadCloud className="size-3.5 mr-1.5" />
                      Importar (.xlsx)
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => setOpenCrearInvitado(true)}
                      className="h-10 text-xs font-semibold px-3"
                    >
                      <Plus className="size-3.5 mr-1" />
                      Agregar Invitado
                    </Button>
                  </div>
                </div>

                {/* Barra de Selección Masiva (PRUEBAS-USUARIO §21d) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium">
                      Seleccionados: <strong>{selectedIds.size}</strong> de {invitadosFiltrados.length}
                    </span>
                    {selectedIds.size > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={limpiarSeleccion}
                        className="h-6 text-[11px] px-2 text-destructive hover:bg-destructive/10"
                      >
                        Limpiar selección
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {invitadosFiltrados.length > 0 && selectedIds.size < invitadosFiltrados.length && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={seleccionarTodosLosFiltrados}
                        className="h-7 text-xs text-primary font-medium hover:underline"
                      >
                        Seleccionar todos los resultados del filtro ({invitadosFiltrados.length})
                      </Button>
                    )}

                    {selectedIds.size > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveTab("emision")}
                        className="h-7 text-xs font-semibold px-2.5"
                      >
                        Ir a Emisión de Gafetes ({selectedIds.size}) →
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabla de Invitados */}
            <Card className="border-border/60 shadow-xs bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50 border-b border-border/60">
                    <TableRow>
                      <TableHead className="w-10 p-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={toggleSeleccionarPagina}
                          className="size-6 p-0"
                          title="Seleccionar todos en esta página"
                        >
                          {estanTodosDePaginaSeleccionados ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="p-3 text-xs">Código</TableHead>
                      <TableHead className="p-3 text-xs">Asistente / Institución</TableHead>
                      <TableHead className="p-3 text-xs">Categoría</TableHead>
                      <TableHead className="p-3 text-xs">Zona</TableHead>
                      <TableHead className="p-3 text-xs">Gafete</TableHead>
                      <TableHead className="p-3 text-xs">Ingreso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitadosPaginados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="p-8 text-center text-xs text-muted-foreground">
                          No se encontraron asistentes para los criterios seleccionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitadosPaginados.map((inv) => {
                        const isSelected = selectedIds.has(inv.id);
                        return (
                          <TableRow
                            key={inv.id}
                            className={`hover:bg-muted/40 transition-colors text-xs ${isSelected ? "bg-primary/5" : ""}`}
                          >
                            <TableCell className="p-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSelectRow(inv.id)}
                                className="size-6 p-0"
                              >
                                {isSelected ? (
                                  <CheckSquare className="size-4 text-primary" />
                                ) : (
                                  <Square className="size-4 text-muted-foreground" />
                                )}
                              </Button>
                            </TableCell>

                            <TableCell className="p-3 font-mono text-muted-foreground">
                              {inv.codigo_credencial || "S/C"}
                            </TableCell>

                            <TableCell className="p-3">
                              <div className="font-bold text-foreground">
                                {inv.nombre_completo}
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                {inv.documento_identidad ? `C.I. ${inv.documento_identidad}` : ""}
                                {inv.organizacion ? ` · ${inv.organizacion}` : ""}
                              </div>
                            </TableCell>

                            <TableCell className="p-3">
                              <Badge variant="outline" className="text-[10px]">
                                {inv.categoria_nombre || "General"}
                              </Badge>
                            </TableCell>

                            <TableCell className="p-3 font-medium text-muted-foreground">
                              {inv.zona_nombre || "General"}
                              {inv.mesa && ` · Mesa: ${inv.mesa}`}
                            </TableCell>

                            <TableCell className="p-3">
                              {inv.estado === "emitido" || inv.estado === "ingreso" || Boolean(inv.codigo_credencial || inv.fecha_emision) ? (
                                <Badge variant="outline" className="border-success/30 bg-success-soft text-success text-[10px]">
                                  Emitido
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                                  Pendiente
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="p-3">
                              {inv.estado === "ingreso" || Boolean(inv.fecha_ingreso) ? (
                                <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-success">
                                  <CheckCircle2 className="size-3" />
                                  {inv.hora_ingreso_formateada || "Sí"}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">No ingresó</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Barra de Paginación */}
              <div className="p-3 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
                <div>
                  Mostrando {invitadosFiltrados.length > 0 ? indiceInicio + 1 : 0} -{" "}
                  {Math.min(indiceInicio + filasPorPagina, invitadosFiltrados.length)} de{" "}
                  {invitadosFiltrados.length} invitados
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
          </TabsContent>

          {/* ============================================================== */}
          {/* PESTAÑA 3: EMISIÓN DE GAFETES (LOTE Y SELECCIÓN MASIVA)        */}
          {/* ============================================================== */}
          <TabsContent value="emision" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Columna Izquierda: Parámetros de Emisión por Lotes */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="border-border/60 bg-card shadow-xs">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Printer className="size-4 text-primary" />
                      Emisión Masiva de Gafetes (90 × 130 mm)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Genere los gafetes oficiales de acreditación para imprimir o enviar digitalmente.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4 text-xs">
                    <div className="p-3.5 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-foreground block">
                          Asistentes seleccionados para procesamiento:
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {selectedIds.size > 0
                            ? `${selectedIds.size} asistente(s) seleccionado(s) específicamente.`
                            : `Todos los ${invitados.length} asistentes registrados en el evento.`}
                        </span>
                      </div>
                      <Badge variant="default" className="text-xs font-mono font-bold px-2.5 py-1">
                        {selectedIds.size > 0 ? selectedIds.size : invitados.length}
                      </Badge>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          type="button"
                          onClick={handleEmitirLote}
                          className="min-h-11 flex-1 font-semibold text-xs shadow-sm"
                        >
                          <IdCard className="size-4 mr-2" />
                          Emitir Credenciales en Lote
                        </Button>

                        <a
                          href={`/api/v1/carnetizacion/eventos/${evento.id}/pdf/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 w-full font-semibold text-xs border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Download className="size-4 mr-2" />
                            Descargar PDF Completo (90×130 mm)
                          </Button>
                        </a>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleEnviarCorreo}
                        className="min-h-11 w-full font-semibold text-xs"
                      >
                        <Mail className="size-4 mr-2" />
                        Enviar Gafetes por Correo a los Asistentes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Columna Derecha: Vista Previa del Gafete de Evento (90x130 mm) */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="border-border/60 bg-card shadow-xs flex flex-col items-center">
                  <CardHeader className="w-full pb-3 border-b border-border/40">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Vista Previa de Gafete (90 × 130 mm)
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="pt-6 pb-6 flex flex-col items-center">
                    {/* Render visual del Gafete de Evento */}
                    <div className="w-[240px] h-[350px] bg-white rounded-xl shadow-xl border border-slate-300 relative overflow-hidden flex flex-col select-none text-slate-900">
                      {/* Franja de Categoría */}
                      <div className="h-12 bg-[#001f3f] flex items-center justify-between px-3 text-white">
                        <span className="text-[10px] font-black tracking-widest">CONATEL</span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-400 text-slate-900 uppercase">
                          {invitadoParaPreview?.categoria_nombre || "INVITADO"}
                        </span>
                      </div>

                      <div className="flex-1 flex flex-col items-center p-3 text-center">
                        <div className="size-28 bg-slate-50 border border-slate-300 p-1 rounded-xl flex items-center justify-center my-2 shadow-inner">
                          <QrCode className="size-full text-slate-900" />
                        </div>

                        <h4 className="text-xs font-black text-slate-900 leading-tight uppercase line-clamp-2 px-1">
                          {invitadoParaPreview?.nombre_completo || "NOMBRE DEL ASISTENTE"}
                        </h4>

                        <p className="text-[9px] font-medium text-slate-600 mt-1 line-clamp-1">
                          {invitadoParaPreview?.organizacion || "Institución Representada"}
                        </p>

                        <div className="mt-auto w-full pt-2 border-t border-slate-200 flex items-center justify-between text-[8px]">
                          <span className="font-bold text-slate-700">
                            Zona: {invitadoParaPreview?.zona_nombre || "General"}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {invitadoParaPreview?.codigo_credencial || "GAF-2026"}
                          </span>
                        </div>
                      </div>

                      <div className="h-3 bg-[#001f3f]" />
                    </div>

                    <p className="text-[11px] text-muted-foreground mt-3 text-center">
                      Formato oficial para acreditaciones de conferencias y cumbres.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ============================================================== */}
          {/* PESTAÑA 4: CONTROL DE ENTRADA EN VIVO (QR SCANNER INTEGRADO)   */}
          {/* ============================================================== */}
          <TabsContent value="control" className="space-y-4">
            <ControlEntradaQrView initialEventoId={eventoId} embeddedInHub={true} />
          </TabsContent>

          {/* ============================================================== */}
          {/* PESTAÑA 5: CONFIGURACIÓN DEL EVENTO                            */}
          {/* ============================================================== */}
          <TabsContent value="configuracion" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Formulario / Lista de Categorías */}
              <Card className="border-border/60 bg-card shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Settings className="size-4 text-primary" />
                    Categorías de Acreditación
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-4 space-y-4 text-xs">
                  <form onSubmit={handleCrearCategoria} className="flex gap-2">
                    <Input
                      placeholder="Nombre de nueva categoría..."
                      value={nuevaCatNombre}
                      onChange={(e) => setNuevaCatNombre(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <Input
                      type="color"
                      value={nuevaCatColor}
                      onChange={(e) => setNuevaCatColor(e.target.value)}
                      className="h-9 w-12 p-0.5"
                      title="Color distintivo"
                    />
                    <Button type="submit" size="sm" className="h-9 text-xs px-3 font-semibold">
                      Agregar
                    </Button>
                  </form>

                  <div className="space-y-2 pt-2 border-t border-border/40">
                    {categorias.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/40"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="size-3.5 rounded-full"
                            style={{ backgroundColor: c.color_primario || "#001f3f" }}
                          />
                          <span className="font-semibold text-foreground">{c.nombre}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          Activa
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Formulario / Lista de Zonas */}
              <Card className="border-border/60 bg-card shadow-xs">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="size-4 text-primary" />
                    Zonas y Puertas de Acceso
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-4 space-y-4 text-xs">
                  <form onSubmit={handleCrearZona} className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nombre de zona (ej: Auditorio)..."
                        value={nuevaZonaNombre}
                        onChange={(e) => setNuevaZonaNombre(e.target.value)}
                        className="h-9 text-xs flex-1"
                      />
                      <Input
                        placeholder="Cód (ej: ZON-A)"
                        value={nuevaZonaCodigo}
                        onChange={(e) => setNuevaZonaCodigo(e.target.value)}
                        className="h-9 text-xs w-24 font-mono"
                      />
                      <Button type="submit" size="sm" className="h-9 text-xs px-3 font-semibold">
                        Agregar
                      </Button>
                    </div>
                  </form>

                  <div className="space-y-2 pt-2 border-t border-border/40">
                    {zonas.map((z) => (
                      <div
                        key={z.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/40"
                      >
                        <span className="font-semibold text-foreground">{z.nombre}</span>
                        {z.codigo && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {z.codigo}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Diálogos */}
        <InvitadoCrearDialog
          open={openCrearInvitado}
          onOpenChange={setOpenCrearInvitado}
          eventoId={eventoId}
          categorias={categorias}
          zonas={zonas}
          onInvitadoCreado={() => cargarDatos()}
        />

        <InvitadosImportarDialog
          open={openImportarInvitados}
          onOpenChange={setOpenImportarInvitados}
          eventoId={eventoId}
          onImportacionCompletada={() => cargarDatos()}
        />
      </div>
    </PageLayout>
  );
}
