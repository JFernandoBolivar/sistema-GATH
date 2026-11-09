"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
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

interface EventoDetallePanelProps {
  eventoId: string;
}

export function EventoDetallePanel({ eventoId }: EventoDetallePanelProps) {
  const [evento, setEvento] = useState<Evento | null>(null);
  const [panel, setPanel] = useState<PanelEvento | null>(null);
  const [invitados, setInvitados] = useState<EventoInvitado[]>([]);
  const [categorias, setCategorias] = useState<EventoCategoria[]>([]);
  const [zonas, setZonas] = useState<EventoZona[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [catFiltro, setCatFiltro] = useState<string>("");
  const [openCrear, setOpenCrear] = useState(false);
  const [openImportar, setOpenImportar] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargarDatos = () => {
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
  };

  useEffect(() => {
    cargarDatos();
  }, [eventoId]);

  const handleEmitirLote = async () => {
    try {
      setMensaje("Emitiendo credenciales en lote...");
      const res = await emitirCredencialesLoteAction(eventoId);
      setMensaje(`Emisión exitosa: ${res.total_emitidos} credenciales generadas.`);
      cargarDatos();
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error al emitir en lote");
    }
  };

  const handleEnviarCorreo = async () => {
    try {
      setMensaje("Enviando credenciales por correo...");
      const res = await enviarCredencialesCorreoAction(eventoId);
      setMensaje(`Envío finalizado: ${res.total_enviados} correos enviados.`);
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Error al enviar correos");
    }
  };

  const invitadosFiltrados = invitados.filter((inv) => {
    const matchBusqueda =
      !busqueda ||
      inv.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (inv.documento_identidad && inv.documento_identidad.includes(busqueda)) ||
      (inv.codigo_credencial && inv.codigo_credencial.toLowerCase().includes(busqueda.toLowerCase()));
    const matchCat = !catFiltro || inv.categoria_id === catFiltro;
    return matchBusqueda && matchCat;
  });

  if (!evento && isPending) {
    return <div className="p-8 text-center text-muted-foreground">Cargando evento...</div>;
  }

  if (!evento) {
    return <div className="p-8 text-center text-destructive">Evento no encontrado.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cabecera del Evento */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{evento.nombre}</h1>
            <Badge variant="outline" className="uppercase font-semibold text-xs">
              {evento.estado}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            📍 {evento.lugar} • 📅{" "}
            {evento.fecha_inicio ? new Date(evento.fecha_inicio).toLocaleDateString() : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/carnetizacion/control-eventos?evento_id=${evento.id}`}>
            <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700">
              📲 Control de Entrada
            </Button>
          </Link>
          <Button variant="outline" onClick={handleEmitirLote}>
            🎫 Emitir en Lote
          </Button>
          <Button variant="outline" onClick={handleEnviarCorreo}>
            ✉️ Enviar por Correo
          </Button>
          <a
            href={`/api/v1/carnetizacion/eventos/${evento.id}/pdf/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">📄 Gafetes (PDF)</Button>
          </a>
        </div>
      </div>

      {mensaje && (
        <div className="p-3 text-sm bg-primary/10 text-primary rounded-lg border flex justify-between items-center">
          <span>{mensaje}</span>
          <Button variant="ghost" size="sm" onClick={() => setMensaje(null)}>
            ✕
          </Button>
        </div>
      )}

      {/* 4 Tarjetas de Métricas Canónicas (O45-B) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Invitados</CardDescription>
            <CardTitle className="text-3xl font-extrabold">{panel?.total_invitados ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">Aforo registrado</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Emitidas</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
              {panel?.credenciales_emitidas ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">Con código QR</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Entraron (Check-in)</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {panel?.entraron ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {panel?.porcentaje_asistencia ?? 0}% de asistencia
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Faltan por Ingresar</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {panel?.faltan ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">Pendientes en puerta</span>
          </CardContent>
        </Card>
      </div>

      {/* Desglose de Categorías */}
      {panel && Object.keys(panel.por_categoria).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-lg text-xs">
          <span className="font-semibold text-muted-foreground">Categorías:</span>
          {Object.entries(panel.por_categoria).map(([cat, total]) => (
            <Badge key={cat} variant="secondary" className="px-2 py-1">
              {cat}: <strong>{total}</strong>
            </Badge>
          ))}
        </div>
      )}

      {/* Pestañas de Gestión */}
      <Tabs defaultValue="invitados" className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="invitados">Invitados ({invitados.length})</TabsTrigger>
            <TabsTrigger value="configuracion">Categorías y Zonas</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenImportar(true)}>
              📥 Importar Lista
            </Button>
            <Button size="sm" onClick={() => setOpenCrear(true)}>
              + Agregar Invitado
            </Button>
          </div>
        </div>

        <TabsContent value="invitados" className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Buscar por nombre, cédula o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex items-center gap-1">
              <Button
                variant={catFiltro === "" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setCatFiltro("")}
              >
                Todas
              </Button>
              {categorias.map((c) => (
                <Button
                  key={c.id}
                  variant={catFiltro === c.id ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setCatFiltro(c.id)}
                >
                  {c.nombre}
                </Button>
              ))}
            </div>
          </div>

          {/* Tabla de Invitados */}
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Asistente</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ingreso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitadosFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No hay invitados registrados que coincidan con la búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  invitadosFiltrados.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {inv.codigo_credencial}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{inv.nombre_completo}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.documento_identidad || "Sin cédula"} • {inv.organizacion || "Invitado"}
                        </div>
                        {inv.es_acompanante && (
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            Acompañante
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold text-xs">
                          {inv.categoria_nombre || "General"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{inv.zona_nombre || "General"}</TableCell>
                      <TableCell>
                        {inv.estado === "ingreso" ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700">Ingresó</Badge>
                        ) : inv.estado === "emitido" ? (
                          <Badge variant="secondary">Emitida</Badge>
                        ) : (
                          <Badge variant="outline">Registrado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {inv.hora_ingreso_formateada || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={`/api/v1/carnetizacion/eventos/${evento.id}/pdf/?invitado_id=${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm" title="Descargar Gafete PDF">
                            🪪 PDF
                          </Button>
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="configuracion">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Categorías de Asistentes</CardTitle>
                <CardDescription>
                  Colores distintivos y acreditaciones para las bandas de los gafetes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {categorias.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full border shadow-sm"
                        style={{ backgroundColor: c.color_primario }}
                      />
                      <span className="font-medium text-sm">{c.nombre}</span>
                    </div>
                    <Badge variant="outline" style={{ color: c.color_acento }}>
                      Acento
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Zonas y Puntos de Acceso</CardTitle>
                <CardDescription>
                  Espacios autorizados validados en los puntos de control QR.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {zonas.map((z) => (
                  <div
                    key={z.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-sm">{z.nombre}</span>
                      <p className="text-xs text-muted-foreground">Código: {z.codigo || "—"}</p>
                    </div>
                    <Badge variant="secondary">Habilitada</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <InvitadoCrearDialog
        open={openCrear}
        onOpenChange={setOpenCrear}
        eventoId={evento.id}
        categorias={categorias}
        zonas={zonas}
        onInvitadoCreado={cargarDatos}
      />

      <InvitadosImportarDialog
        open={openImportar}
        onOpenChange={setOpenImportar}
        eventoId={evento.id}
        onImportacionCompletada={cargarDatos}
      />
    </div>
  );
}
