"use client";

/**
 * Ficha del trabajador: «Documentos generados» (bajo demanda y del resto de procesos) con el acceso a
 * «Generar documento», y el historial de movimientos con los PDF que cada uno emitió.
 */
import { useState } from "react";
import { FilePlus2, FileStack, History, Loader2, RefreshCw } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { GenerarDocumentoDialog } from "@/modules/documentos/ui/components/generar-documento-dialog";
import { ListaDocumentosGenerados } from "@/modules/documentos/ui/components/lista-documentos-generados";
import { useDocumentosBajoDemanda } from "@/modules/documentos/ui/hooks/use-documentos-datos";
import { formatearFecha } from "@/modules/documentos/ui/lib/etiquetas";
import { getHistorialPorEmpleadoAction } from "@/modules/movimientos/infrastructure/actions/movimientos-actions";
import type { MovimientoCargoDTO } from "@/modules/movimientos/application/dtos/movimientos-dto";

interface Props {
  cedula: string;
  puedeGenerar: boolean;
  puedeVerMovimientos: boolean;
}

export function SeccionDocumentosTrabajador({ cedula, puedeGenerar, puedeVerMovimientos }: Props) {
  const [generando, setGenerando] = useState(false);
  const { plantillas, generados, cargando, error, recargar } = useDocumentosBajoDemanda(cedula, puedeGenerar);

  return (
    <>
      {puedeGenerar && (
        <Card data-testid="seccion-documentos-trabajador">
          <CardHeader>
            <CardTitle className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                Documentos generados <FileStack className="size-5" aria-hidden />
              </span>
              <Button
                type="button"
                size="sm"
                className="h-11 w-full text-xs sm:h-9 sm:w-auto sm:text-sm"
                onClick={() => setGenerando(true)}
                disabled={cargando || Boolean(error)}
              >
                <FilePlus2 className="size-4" aria-hidden /> Generar documento
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cargando && (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando documentos…
              </p>
            )}
            {!cargando && error && (
              <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
                <span>{error}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void recargar()}>
                  <RefreshCw className="size-4" aria-hidden /> Reintentar
                </Button>
              </div>
            )}
            {!cargando && !error && generados.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="sin-documentos-generados">
                Todavía no se ha generado ningún documento para este trabajador.
              </p>
            )}
            {!cargando && !error && generados.length > 0 && (
              <ListaDocumentosGenerados
                documentos={generados.map((g) => ({
                  id: g.id,
                  nombre: g.plantilla_nombre,
                  proceso: g.proceso_etiqueta,
                  version: g.version_numero,
                  fecha: g.generado_en,
                }))}
              />
            )}
          </CardContent>
          <GenerarDocumentoDialog
            abierto={generando}
            onCerrar={() => setGenerando(false)}
            trabajadorCedula={cedula}
            plantillas={plantillas}
            onGenerado={() => void recargar()}
          />
        </Card>
      )}
      {puedeVerMovimientos && <HistorialMovimientosFicha cedula={cedula} />}
    </>
  );
}

function HistorialMovimientosFicha({ cedula }: { cedula: string }) {
  const { data, isLoading, error, mutate } = useSWR<MovimientoCargoDTO[]>(
    ["ficha/historial-movimientos", cedula],
    async () => {
      const r = await getHistorialPorEmpleadoAction(cedula);
      if (!Array.isArray(r)) throw new Error(r.error);
      return r;
    },
    { revalidateOnFocus: false },
  );
  const movimientos = data ?? [];

  return (
    <Card data-testid="historial-movimientos-ficha">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Historial de movimientos <History className="size-5" aria-hidden />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando movimientos…
          </p>
        )}
        {!isLoading && error && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{error instanceof Error ? error.message : "No se pudo cargar el historial."}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void mutate()}>
              <RefreshCw className="size-4" aria-hidden /> Reintentar
            </Button>
          </div>
        )}
        {!isLoading && !error && movimientos.length === 0 && (
          <p className="text-sm text-muted-foreground">Este trabajador no tiene movimientos registrados.</p>
        )}
        {movimientos.length > 0 && (
          <ol className="grid gap-3">
            {movimientos.map((m) => (
              <li key={m.id} className="grid gap-2 rounded-lg border p-3 text-sm" data-testid="movimiento-ficha">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold">{m.tipoMovimiento || "Movimiento"}</span>
                  <span className="text-xs text-muted-foreground">{formatearFecha(m.fechaMovimiento)}</span>
                </div>
                <p className="text-muted-foreground">
                  {[m.motivoNombre, m.especificaNombre || m.denominacionNombre, m.dependenciaNombre].filter(Boolean).join(" · ")}
                </p>
                {(m.documentosGenerados ?? []).length > 0 && (
                  <ListaDocumentosGenerados
                    testId="documentos-movimiento"
                    documentos={(m.documentosGenerados ?? []).map((d) => ({
                      id: d.id,
                      nombre: d.nombre,
                      version: d.version,
                      fecha: d.fecha,
                    }))}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
