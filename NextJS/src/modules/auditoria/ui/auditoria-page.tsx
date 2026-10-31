"use client";

/**
 * Bitácora de auditoría (D10), solo lectura. Dos pestañas: registros de la
 * bitácora y los incidentes de seguridad del login. Filtros con valores reales,
 * paginación en el servidor, detalle antes/después saneado y exportación
 * PDF/Excel con los filtros aplicados.
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Download, Filter, ShieldAlert, X } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { avisoTopeDeFilas } from "@/shared/lib/aviso-tope";

import type {
  DetalleAuditoriaDTO,
  FiltrosAuditoria,
  PaginaAuditoriaDTO,
  PaginaIncidentesDTO,
} from "../application/dtos/auditoria-dto";
import {
  consultarAuditoriaAction,
  consultarIncidentesAction,
  getOpcionesAuditoriaAction,
  obtenerDetalleAuditoriaAction,
} from "../infrastructure/actions/auditoria-actions";
import {
  ETIQUETA_RESULTADO,
  PERMISO_AUDITORIA,
} from "../domain/value-objects/permisos-auditoria";
import {
  FILTROS_VACIOS,
  filtrosAuditoriaSchema,
  type FiltrosAuditoriaForm,
} from "./schema/schema-auditoria";
import { descargarBitacora } from "./services/descargas-auditoria";

const TAMANO_PAGINA = 10;

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(fecha);
}

function valorLegible(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor === "object") {
    return Object.entries(valor as Record<string, unknown>)
      .map(([clave, item]) => `${clave}: ${valorLegible(item)}`)
      .join("; ");
  }
  return String(valor);
}

function esError(valor: unknown): valor is { error: string } {
  return !!valor && typeof valor === "object" && "error" in valor;
}

export function AuditoriaPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVer = tienePermiso(permisos, PERMISO_AUDITORIA.verLogs);
  const puedeExportar = tienePermiso(permisos, PERMISO_AUDITORIA.exportar);
  const puedeVerSeguridad = tienePermiso(permisos, PERMISO_AUDITORIA.verSeguridad);

  const form = useForm<FiltrosAuditoriaForm>({
    resolver: zodResolver(filtrosAuditoriaSchema),
    defaultValues: FILTROS_VACIOS,
  });
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({});
  const [pagina, setPagina] = useState(1);
  const [paginaIncidentes, setPaginaIncidentes] = useState(1);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exportando, setExportando] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const { data: opciones } = useSWR("auditoria-opciones", getOpcionesAuditoriaAction);
  const opcionesUtiles = opciones && !esError(opciones) ? opciones : null;

  const { data, isLoading, mutate } = useSWR(
    puedeVer ? ["auditoria", filtros, pagina] : null,
    () => consultarAuditoriaAction(filtros, pagina, TAMANO_PAGINA),
  );
  const { data: incidentes, isLoading: cargandoIncidentes } = useSWR(
    puedeVerSeguridad ? ["auditoria-incidentes", filtros, paginaIncidentes] : null,
    () => consultarIncidentesAction(filtros, paginaIncidentes, TAMANO_PAGINA),
  );

  const paginaDatos = data && !esError(data) ? (data as PaginaAuditoriaDTO) : null;
  const paginaIncidentesDatos =
    incidentes && !esError(incidentes) ? (incidentes as PaginaIncidentesDTO) : null;
  const error = esError(data) ? data.error : null;

  function aplicar(valores: FiltrosAuditoriaForm) {
    setAviso(null);
    setPagina(1);
    setPaginaIncidentes(1);
    setFiltros({
      usuario: valores.usuario || undefined,
      accion: valores.accion || undefined,
      modulo: valores.modulo || undefined,
      recurso: valores.recurso || undefined,
      ip: valores.ip || undefined,
      desde: valores.desde || undefined,
      hasta: valores.hasta || undefined,
      resultado: valores.resultado || undefined,
    });
  }

  function limpiar() {
    form.reset(FILTROS_VACIOS);
    setAviso(null);
    setFiltros({});
    setPagina(1);
    setPaginaIncidentes(1);
  }

  function exportar(formato: "pdf" | "excel") {
    setExportando(formato);
    setAviso(null);
    startTransition(async () => {
      try {
        const archivo = await descargarBitacora(formato, filtros);
        const mensaje = avisoTopeDeFilas(archivo);
        setAviso(mensaje);
        if (mensaje) toast.warning(mensaje);
        const url = window.URL.createObjectURL(archivo.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bitacora-auditoria.${formato === "excel" ? "xlsx" : "pdf"}`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No fue posible exportar la bitácora.");
      } finally {
        setExportando(null);
      }
    });
  }

  if (!puedeVer) {
    return (
      <PageLayout title="Bitácora de auditoría">
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          No tiene el permiso «{PERMISO_AUDITORIA.verLogs}» para consultar la bitácora.
        </p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Bitácora de auditoría"
      description="Consulta de solo lectura de las acciones del sistema y de los incidentes de seguridad."
    >
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(aplicar)} className="grid gap-3 md:grid-cols-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-usuario">Usuario</Label>
              <Input id="aud-usuario" placeholder="Cédula o nombre" {...form.register("usuario")} className="bg-white" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-accion">Acción</Label>
              <select id="aud-accion" {...form.register("accion")} className="h-9 rounded-md border bg-white px-2 text-sm">
                <option value="">Todas</option>
                {(opcionesUtiles?.acciones ?? []).map((accion) => (
                  <option key={accion} value={accion}>{accion}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-modulo">Módulo</Label>
              <select id="aud-modulo" {...form.register("modulo")} className="h-9 rounded-md border bg-white px-2 text-sm">
                <option value="">Todos</option>
                {(opcionesUtiles?.modulos ?? []).map((modulo) => (
                  <option key={modulo} value={modulo}>{modulo}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-resultado">Resultado</Label>
              <select id="aud-resultado" {...form.register("resultado")} className="h-9 rounded-md border bg-white px-2 text-sm">
                <option value="">Todos</option>
                {(opcionesUtiles?.resultados ?? []).map((resultado) => (
                  <option key={resultado} value={resultado}>{ETIQUETA_RESULTADO[resultado] ?? resultado}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-recurso">Recurso</Label>
              <Input id="aud-recurso" placeholder="Tipo o identificador" {...form.register("recurso")} className="bg-white" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-ip">IP</Label>
              <Input id="aud-ip" placeholder="10.0.0.1" {...form.register("ip")} className="bg-white" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-desde">Desde</Label>
              <Input id="aud-desde" type="date" {...form.register("desde")} className="bg-white" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-hasta">Hasta</Label>
              <Input id="aud-hasta" type="date" {...form.register("hasta")} className="bg-white" />
              {form.formState.errors.hasta && (
                <p role="alert" className="text-xs text-destructive">{form.formState.errors.hasta.message}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 md:col-span-4">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <Filter aria-hidden /> Filtrar
              </Button>
              <Button type="button" variant="outline" onClick={limpiar}>
                <X aria-hidden /> Limpiar
              </Button>
              {puedeExportar && (
                <>
                  <Button type="button" variant="outline" disabled={exportando !== null} onClick={() => exportar("pdf")}>
                    <Download aria-hidden /> {exportando === "pdf" ? "Generando PDF…" : "Exportar PDF"}
                  </Button>
                  <Button type="button" disabled={exportando !== null} onClick={() => exportar("excel")}>
                    <Download aria-hidden /> {exportando === "excel" ? "Generando Excel…" : "Exportar Excel"}
                  </Button>
                </>
              )}
            </div>
          </form>
          {aviso && (
            <p role="status" className="mt-3 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-900">
              {aviso}
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}

      <Tabs defaultValue="bitacora">
        <TabsList>
          <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
          {puedeVerSeguridad && (
            <TabsTrigger value="incidentes">
              <ShieldAlert aria-hidden /> Incidentes de seguridad
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="bitacora">
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : !paginaDatos || paginaDatos.resultados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay registros para los filtros seleccionados.</p>
          ) : (
            <>
              <Table>
                <TableCaption>
                  {paginaDatos.total} registro(s); página {paginaDatos.pagina} de {paginaDatos.totalPaginas}.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha y hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead className="text-right">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginaDatos.resultados.map((registro) => (
                    <TableRow key={registro.id}>
                      <TableCell className="whitespace-nowrap">{formatearFecha(registro.fechaHora)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{registro.actorCedula || "—"}</span>
                        {registro.actorNombre && (
                          <span className="block text-xs text-muted-foreground">{registro.actorNombre}</span>
                        )}
                      </TableCell>
                      <TableCell>{registro.actorRol || "—"}</TableCell>
                      <TableCell>{registro.accion}</TableCell>
                      <TableCell>{registro.modulo}</TableCell>
                      <TableCell>{`${registro.recursoTipo}#${registro.recursoId}`.replace(/^#|#$/g, "") || "—"}</TableCell>
                      <TableCell>{registro.ip || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={registro.resultado === "SUCCESS" ? "secondary" : "destructive"}>
                          {ETIQUETA_RESULTADO[registro.resultado] ?? registro.resultado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setDetalleId(registro.id)}>
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Paginador
                pagina={paginaDatos.pagina}
                totalPaginas={paginaDatos.totalPaginas}
                onCambiar={setPagina}
              />
            </>
          )}
        </TabsContent>

        {puedeVerSeguridad && (
          <TabsContent value="incidentes">
            {cargandoIncidentes ? (
              <Skeleton className="h-64 w-full" />
            ) : !paginaIncidentesDatos || paginaIncidentesDatos.resultados.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No hay incidentes de seguridad registrados.</p>
            ) : (
              <>
                <Table>
                  <TableCaption>
                    {paginaIncidentesDatos.total} incidente(s); página {paginaIncidentesDatos.pagina} de{" "}
                    {paginaIncidentesDatos.totalPaginas}.
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha y hora</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginaIncidentesDatos.resultados.map((incidente) => (
                      <TableRow key={incidente.id}>
                        <TableCell className="whitespace-nowrap">{formatearFecha(incidente.fechaHora)}</TableCell>
                        <TableCell>{incidente.cedula}</TableCell>
                        <TableCell>{incidente.nombre || "—"}</TableCell>
                        <TableCell>{incidente.ip || "—"}</TableCell>
                        <TableCell>{incidente.resultado}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Paginador
                  pagina={paginaIncidentesDatos.pagina}
                  totalPaginas={paginaIncidentesDatos.totalPaginas}
                  onCambiar={setPaginaIncidentes}
                />
              </>
            )}
          </TabsContent>
        )}
      </Tabs>

      <DetalleAuditoriaDialog id={detalleId} onCerrar={() => setDetalleId(null)} onRefrescar={mutate} />
    </PageLayout>
  );
}

function Paginador({
  pagina,
  totalPaginas,
  onCambiar,
}: {
  pagina: number;
  totalPaginas: number;
  onCambiar: (pagina: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-3">
      <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
        Anterior
      </Button>
      <span className="text-xs text-muted-foreground">Página {pagina} de {totalPaginas}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={pagina >= totalPaginas}
        onClick={() => onCambiar(pagina + 1)}
      >
        Siguiente
      </Button>
    </div>
  );
}

function DetalleAuditoriaDialog({
  id,
  onCerrar,
  onRefrescar,
}: {
  id: string | null;
  onCerrar: () => void;
  onRefrescar: () => void;
}) {
  const { data, isLoading } = useSWR(id ? ["auditoria-detalle", id] : null, () =>
    obtenerDetalleAuditoriaAction(id as string),
  );
  const detalle = data && !esError(data) ? (data as DetalleAuditoriaDTO) : null;

  return (
    <Dialog open={id !== null} onOpenChange={(abierto) => !abierto && (onCerrar(), onRefrescar())}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del registro</DialogTitle>
          <DialogDescription>
            Estado anterior y nuevo, con las diferencias ya saneadas (sin contraseñas, tokens ni hashes).
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !detalle ? (
          <p role="alert" className="text-sm text-destructive">No fue posible cargar el detalle.</p>
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <Dato etiqueta="Fecha y hora" valor={formatearFecha(detalle.fechaHora)} />
              <Dato etiqueta="Usuario" valor={`${detalle.actorCedula} ${detalle.actorNombre}`.trim()} />
              <Dato etiqueta="Rol" valor={detalle.actorRol || "—"} />
              <Dato etiqueta="Acción" valor={detalle.accion} />
              <Dato etiqueta="Módulo" valor={detalle.modulo} />
              <Dato etiqueta="Recurso" valor={`${detalle.recursoTipo}#${detalle.recursoId}`.replace(/^#|#$/g, "") || "—"} />
              <Dato etiqueta="IP" valor={detalle.ip || "—"} />
              <Dato etiqueta="Dispositivo" valor={detalle.userAgent || "—"} />
              <Dato etiqueta="Resultado" valor={ETIQUETA_RESULTADO[detalle.resultado] ?? detalle.resultado} />
            </dl>

            {detalle.diferencias.length === 0 ? (
              <p className="text-muted-foreground">El registro no tiene diferencias de estado.</p>
            ) : (
              <Table>
                <TableCaption>Campos que cambiaron</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead>Antes</TableHead>
                    <TableHead>Después</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.diferencias.map((diferencia) => (
                    <TableRow key={diferencia.campo}>
                      <TableCell className="font-medium">{diferencia.campo}</TableCell>
                      <TableCell>{valorLegible(diferencia.antes)}</TableCell>
                      <TableCell>{valorLegible(diferencia.despues)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
      <dd className="break-words">{valor || "—"}</dd>
    </div>
  );
}
