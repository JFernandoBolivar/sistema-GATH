"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatearFechaHora, formatearTamano } from "@/modules/captacion/domain/formato";
import type { Constancia, ResultadoAccion } from "../../domain/solicitud";
import { entregarPdf } from "../descarga";

interface Props {
  constancia: Constancia;
  /** Descarga del adjunto PDF; ausente = sin botón. */
  onDescargar?: () => Promise<ResultadoAccion<{ base64: string; nombre: string }>>;
  onAviso: (tipo: "exito" | "error", mensaje: string) => void;
}

/** Constancia ya declarada: referencia, quién y cuándo, y el adjunto descargable. */
export function ConstanciaDeclarada({ constancia, onDescargar, onAviso }: Props) {
  const [descargando, setDescargando] = useState(false);

  async function descargar() {
    if (!onDescargar) return;
    setDescargando(true);
    const r = await onDescargar();
    setDescargando(false);
    if (!r.ok) {
      onAviso("error", r.error);
      return;
    }
    entregarPdf(r.data.base64, r.data.nombre);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="constancia-declarada">
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Referencia</dt>
          <dd className="break-words text-base font-semibold" data-testid="constancia-referencia">{constancia.referencia}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Declarada por</dt>
          <dd className="break-words text-sm font-medium">
            {constancia.declaradoPorNombre || "—"} {constancia.declaradoPorCedula ? `(C.I. ${constancia.declaradoPorCedula})` : ""}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Fecha</dt>
          <dd className="text-sm font-medium">{formatearFechaHora(constancia.fecha)}</dd>
        </div>
        {constancia.observaciones ? (
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Observaciones</dt>
            <dd className="whitespace-pre-line break-words text-sm">{constancia.observaciones}</dd>
          </div>
        ) : null}
      </dl>
      {constancia.tieneAdjunto && onDescargar ? (
        <Button type="button" variant="outline" className="w-full sm:w-fit" onClick={descargar} disabled={descargando}>
          {descargando ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          Descargar constancia PDF {constancia.adjuntoTamano ? `(${formatearTamano(constancia.adjuntoTamano)})` : ""}
        </Button>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4" aria-hidden /> {constancia.tieneAdjunto ? "Tiene adjunto." : "Sin adjunto."}
        </p>
      )}
    </div>
  );
}
