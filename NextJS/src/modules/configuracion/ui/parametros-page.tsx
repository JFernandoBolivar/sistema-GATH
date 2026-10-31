"use client";

/**
 * Parámetros del sistema (D9). Agrupados por tema; cada valor se valida con Zod
 * en el cliente y en el backend, se confirma antes de guardar y deja historial
 * paginado (AuditoriaLog). Al guardar se aplica sin reiniciar: los módulos leen
 * el valor por el puerto en cada uso.
 */
import { useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { History, Save } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type { ParametroDTO, PaginaCambiosDTO } from "../application/dtos/parametro-dto";
import {
  actualizarParametroAction,
  historialParametroAction,
  listarParametrosAction,
} from "../infrastructure/actions/parametros-actions";
import { GRUPOS_PARAMETROS, PERMISO_CONFIGURACION } from "../domain/value-objects/permisos-configuracion";
import { normalizarValorParametro, validarValorParametro } from "./schema/schema-parametros";

const PAGINA_INICIAL = 1;

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(fecha);
}

export function ParametrosPage() {
  const { data: session } = useSession();
  const puedeEditar = tienePermiso(session?.user?.permisos, PERMISO_CONFIGURACION.editar);
  const { data, isLoading, mutate } = useSWR("parametros-sistema", listarParametrosAction);

  const parametros = useMemo<ParametroDTO[]>(
    () => (Array.isArray(data) ? data : []),
    [data],
  );
  const [ediciones, setEdiciones] = useState<Record<string, string>>({});
  const [pendiente, setPendiente] = useState<{ parametro: ParametroDTO; valor: string } | null>(null);
  const [historialDe, setHistorialDe] = useState<ParametroDTO | null>(null);
  const [isPending, startTransition] = useTransition();

  function solicitarCambio(parametro: ParametroDTO, valor: string): boolean {
    const error = validarValorParametro(parametro, valor);
    if (error) {
      toast.error(error);
      return false;
    }
    setPendiente({ parametro, valor });
    return true;
  }

  function descartarEdicion(clave: string) {
    setEdiciones((prev) => {
      const copia = { ...prev };
      delete copia[clave];
      return copia;
    });
  }

  function cancelar() {
    if (pendiente) descartarEdicion(pendiente.parametro.clave);
    setPendiente(null);
  }

  function confirmar() {
    if (!pendiente) return;
    const { parametro, valor } = pendiente;
    startTransition(async () => {
      const resultado = await actualizarParametroAction(
        parametro.clave,
        normalizarValorParametro(parametro, valor),
      );
      if (!resultado || typeof resultado !== "object" || "error" in resultado) {
        toast.error(
          (resultado as { error?: string })?.error ?? "No fue posible guardar el parámetro.",
        );
        cancelar();
        return;
      }
      toast.success(`«${parametro.etiqueta}» actualizado.`);
      setPendiente(null);
      descartarEdicion(parametro.clave);
      await mutate();
    });
  }

  return (
    <PageLayout
      title="Parámetros del sistema"
      description="Aplican de inmediato, sin reiniciar el sistema. Cada cambio queda en la bitácora de auditoría."
    >
      {!puedeEditar && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          No tiene el permiso «{PERMISO_CONFIGURACION.editar}» para editar la configuración.
        </p>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {GRUPOS_PARAMETROS.map((grupo) => {
            const delGrupo = parametros.filter((p) => p.grupo === grupo.clave);
            if (delGrupo.length === 0) return null;
            return (
              <Card key={grupo.clave}>
                <CardHeader>
                  <CardTitle>{grupo.etiqueta}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col divide-y">
                  {delGrupo.map((parametro) => {
                    const valor = ediciones[parametro.clave] ?? parametro.valor;
                    return (
                      <div
                        key={parametro.clave}
                        data-parametro={parametro.clave}
                        className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="max-w-xl">
                          <Label htmlFor={`param-${parametro.clave}`} className="text-base font-medium">
                            {parametro.etiqueta}
                          </Label>
                          <p className="text-sm text-muted-foreground">{parametro.descripcion}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {parametro.tipo === "booleano" ? (
                            <Switch
                              id={`param-${parametro.clave}`}
                              checked={valor === "true"}
                              disabled={!puedeEditar || isPending}
                              onCheckedChange={(marcado) => {
                                const nuevo = marcado ? "true" : "false";
                                if (solicitarCambio(parametro, nuevo)) {
                                  setEdiciones((prev) => ({ ...prev, [parametro.clave]: nuevo }));
                                }
                              }}
                              aria-label={parametro.etiqueta}
                            />
                          ) : (
                            <Input
                              id={`param-${parametro.clave}`}
                              type={parametro.tipo === "entero" ? "number" : "text"}
                              inputMode={parametro.tipo === "entero" ? "numeric" : undefined}
                              min={parametro.minimo ?? undefined}
                              max={parametro.maximo ?? undefined}
                              value={valor}
                              disabled={!puedeEditar || isPending}
                              onChange={(e) =>
                                setEdiciones((prev) => ({ ...prev, [parametro.clave]: e.target.value }))
                              }
                              className="w-44 bg-white"
                            />
                          )}
                          {parametro.tipo !== "booleano" && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={!puedeEditar || isPending || valor === parametro.valor}
                              onClick={() => solicitarCambio(parametro, valor)}
                            >
                              <Save aria-hidden /> Guardar
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setHistorialDe(parametro)}
                          >
                            <History aria-hidden /> Historial
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={pendiente !== null} onOpenChange={(abierto) => !abierto && cancelar()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio</AlertDialogTitle>
            <AlertDialogDescription>
              {pendiente && (
                <>
                  ¿Guardar <strong>{pendiente.parametro.etiqueta}</strong> con el valor{" "}
                  <strong>{pendiente.valor}</strong>? El valor anterior era{" "}
                  <strong>{pendiente.parametro.valor}</strong>. Se aplicará sin reiniciar.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelar}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirmar();
              }}
              disabled={isPending}
            >
              {isPending ? "Guardando…" : "Guardar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HistorialDialog
        key={historialDe?.clave ?? "sin-historial"}
        parametro={historialDe}
        onCerrar={() => setHistorialDe(null)}
      />
    </PageLayout>
  );
}

function HistorialDialog({
  parametro,
  onCerrar,
}: {
  parametro: ParametroDTO | null;
  onCerrar: () => void;
}) {
  const [pagina, setPagina] = useState(PAGINA_INICIAL);
  const clave = parametro?.clave;
  const { data, isLoading } = useSWR(
    parametro ? ["historial-parametro", clave, pagina] : null,
    () => historialParametroAction(clave as string, pagina, 10),
  );

  const error = data && typeof data === "object" && "error" in data ? String(data.error) : null;
  const paginaDatos = data && !error ? (data as PaginaCambiosDTO) : null;

  return (
    <Dialog open={parametro !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial de «{parametro?.etiqueta}»</DialogTitle>
          <DialogDescription>Últimos cambios registrados en la bitácora, del más reciente al más antiguo.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : !paginaDatos || paginaDatos.resultados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay cambios registrados.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <caption className="sr-only">Historial de cambios del parámetro</caption>
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="py-2">Fecha</th>
                  <th scope="col" className="py-2">Usuario</th>
                  <th scope="col" className="py-2">Anterior</th>
                  <th scope="col" className="py-2">Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {paginaDatos.resultados.map((cambio, indice) => (
                  <tr key={`${cambio.fecha}-${indice}`} className="border-b last:border-0">
                    <td className="py-2">{formatearFecha(cambio.fecha)}</td>
                    <td className="py-2">{cambio.actorCedula || "—"}</td>
                    <td className="py-2">{cambio.valorPrevio}</td>
                    <td className="py-2">{cambio.valorNuevo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Badge variant="outline">
                Página {paginaDatos.pagina} de {paginaDatos.totalPaginas}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={paginaDatos.pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={paginaDatos.pagina >= paginaDatos.totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
