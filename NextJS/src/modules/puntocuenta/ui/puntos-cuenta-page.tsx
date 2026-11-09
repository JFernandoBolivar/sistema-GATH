"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, FileText, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
import { Field, FieldLabel } from "@/shared/ui/components/field";
import { FiltrosColapsables, FiltroFechasPar } from "@/shared/ui/components/filtros-movil-colapsable";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listarPuntosCuentaAction } from "../infrastructure/actions/puntocuenta-actions";
import type { FiltrosPuntoCuenta, PuntoCuentaItem } from "../domain/entities/punto-cuenta";
import { getDireccionesGeneralesAction } from "@/modules/cargos/infrastructure/actions/cargos-actions";
import type { UnidadOrganizativaCargoDTO } from "@/modules/cargos/application/dtos/cargo-dto";

const ITEMS_POR_PAGINA = 10;

export function PuntosCuentaPage() {
  const [items, setItems] = useState<PuntoCuentaItem[]>([]);
  const [oficinas, setOficinas] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [isPending, startTransition] = useTransition();
  const [descargandoId, setDescargandoId] = useState<string | null>(null);

  // Filtros
  const [cedula, setCedula] = useState("");
  const [oficinaId, setOficinaId] = useState<string>("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);

  const cargarDatos = (filtrosAplicados?: FiltrosPuntoCuenta) => {
    startTransition(async () => {
      const res = await listarPuntosCuentaAction(filtrosAplicados);
      if (res.success && res.data) {
        setItems(res.data);
        setPaginaActual(1);
      } else {
        toast.error(res.error || "No fue posible cargar los puntos de cuenta");
      }
    });
  };

  useEffect(() => {
    cargarDatos();
    (async () => {
      try {
        const ofis = await getDireccionesGeneralesAction();
        setOficinas(ofis);
      } catch {
        // Silencioso
      }
    })();
  }, []);

  const handleFiltrar = (e: React.FormEvent) => {
    e.preventDefault();
    cargarDatos({
      cedula: cedula.trim() || undefined,
      oficina_id: oficinaId !== "todos" ? oficinaId : undefined,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
    });
  };

  const handleLimpiar = () => {
    setCedula("");
    setOficinaId("todos");
    setFechaDesde("");
    setFechaHasta("");
    cargarDatos();
  };

  const handleDescargarPdf = async (id: string, numero: string | null) => {
    setDescargandoId(id);
    try {
      const res = await fetch(`/api/puntocuenta/${id}/pdf`);
      if (!res.ok) {
        throw new Error("No fue posible generar o descargar el documento.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `punto_cuenta_${numero || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Documento descargado correctamente");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al descargar el PDF");
    } finally {
      setDescargandoId(null);
    }
  };

  // Paginación local
  const totalPaginas = Math.ceil(items.length / ITEMS_POR_PAGINA) || 1;
  const indiceInicio = (paginaActual - 1) * ITEMS_POR_PAGINA;
  const itemsPaginados = items.slice(indiceInicio, indiceInicio + ITEMS_POR_PAGINA);

  return (
    <PageLayout
      title="Puntos de cuenta"
      description="Consulta y descarga de los puntos de cuenta administrativos generados por movimientos de personal."
    >
      <div className="space-y-4">
        {/* Filtros */}
        {(() => {
          const conteoFiltros = [
            cedula.trim(),
            oficinaId && oficinaId !== "todos" ? oficinaId : undefined,
            fechaDesde,
            fechaHasta,
          ].filter(Boolean).length;

          return (
            <FiltrosColapsables conteoActivos={conteoFiltros} titulo="Filtros de búsqueda">
              <form onSubmit={handleFiltrar} className="space-y-4">
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Field className="min-w-0">
                    <FieldLabel htmlFor="filtro-cedula">Cédula</FieldLabel>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="filtro-cedula"
                        placeholder="Ej. 12345678"
                        value={cedula}
                        onChange={(e) => setCedula(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </Field>

                  <Field className="min-w-0">
                    <FieldLabel htmlFor="filtro-oficina">Oficina / Gerencia</FieldLabel>
                    <Select value={oficinaId} onValueChange={setOficinaId}>
                      <SelectTrigger id="filtro-oficina" className="w-full min-w-0">
                        <SelectValue placeholder="Todas las oficinas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas las oficinas</SelectItem>
                        {oficinas.map((ofi) => (
                          <SelectItem key={ofi.id} value={String(ofi.id)}>
                            {ofi.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <FiltroFechasPar>
                    <Field className="min-w-0">
                      <FieldLabel htmlFor="filtro-desde">Fecha desde</FieldLabel>
                      <Input
                        id="filtro-desde"
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                      />
                    </Field>

                    <Field className="min-w-0">
                      <FieldLabel htmlFor="filtro-hasta">Fecha hasta</FieldLabel>
                      <Input
                        id="filtro-hasta"
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                      />
                    </Field>
                  </FiltroFechasPar>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleLimpiar}>
                    <RefreshCw className="size-3.5 mr-1" /> Limpiar
                  </Button>
                  <Button type="submit" size="sm" className="w-full sm:w-auto" disabled={isPending}>
                    {isPending ? (
                      <Loader2 className="size-3.5 mr-1 animate-spin" />
                    ) : (
                      <Search className="size-3.5 mr-1" />
                    )}
                    Buscar
                  </Button>
                </div>
              </form>
            </FiltrosColapsables>
          );
        })()}

        {/* Tabla de Puntos de Cuenta */}
        <Card>
          <CardContent className="p-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">N.º Punto</TableHead>
                    <TableHead className="w-[110px]">Fecha</TableHead>
                    <TableHead>Trabajador</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right w-[110px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isPending && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
                        Cargando puntos de cuenta...
                      </TableCell>
                    </TableRow>
                  ) : itemsPaginados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                        <FileText className="size-8 mx-auto mb-2 opacity-40" />
                        No se encontraron puntos de cuenta registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itemsPaginados.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold text-xs">
                          {item.numero || item.id.substring(0, 8)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.fecha ? new Date(item.fecha).toLocaleDateString("es-VE") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-xs">{item.empleado_nombre || "—"}</div>
                          <div className="text-[11px] text-muted-foreground">C.I. {item.empleado_cedula}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.cargo_nombre || item.cargo_codigo || `Cargo #${item.cargo_id}`}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.oficina_origen || item.dependencia_origen_nombre || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.oficina_destino || item.dependencia_destino_nombre || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.motivo_nombre || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1"
                            disabled={descargandoId === item.id}
                            onClick={() => handleDescargarPdf(item.id, item.numero)}
                            title="Descargar PDF del punto de cuenta"
                          >
                            {descargandoId === item.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Download className="size-3.5" />
                            )}
                            <span className="hidden sm:inline">PDF</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            {items.length > ITEMS_POR_PAGINA && (
              <div className="flex items-center justify-between p-4 border-t text-sm text-muted-foreground">
                <div>
                  Mostrando {indiceInicio + 1} a {Math.min(indiceInicio + ITEMS_POR_PAGINA, items.length)} de {items.length} registros
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaActual <= 1}
                    onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs font-medium">
                    Página {paginaActual} de {totalPaginas}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={paginaActual >= totalPaginas}
                    onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
