"use client";

import { useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useVistaPrevia } from "../hooks/use-vista-previa";

interface Props {
  plantillaId: string;
  payload: Record<string, unknown> | null;
  className?: string;
  /** Alto del visor; por defecto llena el contenedor. */
  altoClase?: string;
}

/** Visor del PDF de vista previa con datos de ejemplo; refleja lo SIN guardar. */
export function VistaPreviaPdf({ plantillaId, payload, className, altoClase = "min-h-[28rem] flex-1" }: Props) {
  const [automatica, setAutomatica] = useState(false);
  const { url, cargando, error, generar } = useVistaPrevia({ plantillaId, payload, automatica });

  return (
    <div className={className ? `flex min-h-0 flex-col gap-2 ${className}` : "flex min-h-0 flex-col gap-2"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" size="sm" onClick={() => void generar()} disabled={cargando || !payload}>
          {cargando ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />} Actualizar vista previa
        </Button>
        <div className="flex items-center gap-2">
          <Switch id="vp-auto" checked={automatica} onCheckedChange={setAutomatica} />
          <Label htmlFor="vp-auto" className="text-sm">Actualizar automáticamente</Label>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className={`relative overflow-hidden rounded-lg border bg-muted/40 ${altoClase}`}>
        {url ? (
          <iframe key={url} src={url} title="Vista previa del documento" className="absolute inset-0 h-full w-full" />
        ) : (
          <div className="flex h-full min-h-[16rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {cargando ? "Generando vista previa…" : "Pulse «Actualizar vista previa» para ver el documento con datos de ejemplo."}
          </div>
        )}
      </div>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start text-xs text-primary underline-offset-4 hover:underline">
          <ExternalLink className="size-3" aria-hidden /> Abrir el PDF en una pestaña nueva
        </a>
      )}
    </div>
  );
}
