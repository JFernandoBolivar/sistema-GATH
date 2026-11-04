"use client";

/**
 * Diálogo «Versiones anteriores» de una imagen del cintillo: miniaturas (más
 * reciente primero) con fecha, quién la subió, marca «Vigente» y «Usar esta».
 * Se conservan las últimas 5 versiones por imagen.
 */
import { useCallback, useEffect, useState, useTransition } from "react";
import { History, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";

import type { ConfiguracionVisualDTO, VersionImagenCintilloDTO } from "../../application/dtos/configuracion-visual-dto";
import type { CampoLogo } from "../../domain/ports/repo-configuracion-visual";
import {
  listarVersionesImagenAction,
  restaurarVersionImagenAction,
} from "../../infrastructure/actions/configuracion-actions";

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short" });

function fechaHora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : FORMATO_FECHA_HORA.format(d);
}

export function VersionesImagenDialog({
  campo,
  etiqueta,
  deshabilitado,
  recarga,
  onRestaurada,
}: {
  campo: CampoLogo;
  etiqueta: string;
  deshabilitado?: boolean;
  /** Cambia cuando se sube una imagen nueva: obliga a recargar la lista. */
  recarga: number;
  onRestaurada: (config: ConfiguracionVisualDTO) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [versiones, setVersiones] = useState<VersionImagenCintilloDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cargar = useCallback(() => {
    setError(null);
    listarVersionesImagenAction(campo).then((resultado) => {
      if ("error" in resultado) {
        setError(resultado.error);
        setVersiones([]);
        return;
      }
      setVersiones(resultado);
    });
  }, [campo]);

  useEffect(() => {
    if (!abierto) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al abrir (recurso externo)
    cargar();
  }, [abierto, recarga, cargar]);

  const usar = (version: VersionImagenCintilloDTO) => {
    setRestaurandoId(version.id);
    startTransition(async () => {
      const resultado = await restaurarVersionImagenAction(campo, version.id);
      setRestaurandoId(null);
      if ("error" in resultado) {
        toast.error(resultado.error);
        return;
      }
      toast.success(`${etiqueta} restaurado correctamente.`);
      onRestaurada(resultado);
      cargar();
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={deshabilitado} className="self-start">
          <History className="mr-1 size-4" />
          Versiones anteriores
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Versiones anteriores</DialogTitle>
          <DialogDescription>
            {etiqueta}. Se conservan las últimas 5 versiones; la más antigua se descarta al subir una nueva.
          </DialogDescription>
        </DialogHeader>

        {versiones === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : versiones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay versiones guardadas de esta imagen.</p>
        ) : (
          <ul className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {versiones.map((v) => (
              <li key={v.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura servida por la API autenticada */}
                <img
                  src={v.url}
                  alt={`Miniatura subida el ${fechaHora(v.subidoEn)}`}
                  className="h-14 w-24 shrink-0 rounded border border-border bg-muted object-contain p-1"
                />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{fechaHora(v.subidoEn)}</p>
                  <p className="truncate text-muted-foreground">
                    {v.subidoPorNombre || v.subidoPorCedula || "Usuario desconocido"}
                  </p>
                </div>
                {v.esVigente ? (
                  <Badge variant="secondary">Vigente</Badge>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => usar(v)}
                  >
                    {restaurandoId === v.id && <Loader2 className="mr-1 size-4 animate-spin" />}
                    Usar esta
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
