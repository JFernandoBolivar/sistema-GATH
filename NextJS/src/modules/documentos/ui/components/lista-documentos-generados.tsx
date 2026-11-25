"use client";

import { Download, FileText, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDescargarDocumento } from "../hooks/use-descargar-documento";
import { formatearFecha } from "../lib/etiquetas";

export interface DocumentoListado {
  id: string;
  nombre: string;
  /** Etiqueta legible del proceso (si se conoce). */
  proceso?: string;
  version: number;
  /** Fecha ISO de generación. */
  fecha: string;
}

interface Props {
  documentos: readonly DocumentoListado[];
  /** Prefijo de los `data-testid`. */
  testId?: string;
}

/** Lista de PDF ya generados, cada uno con su botón de descarga (cómodo al tacto en móvil). */
export function ListaDocumentosGenerados({ documentos, testId = "documentos-generados" }: Props) {
  const { descargando, descargar } = useDescargarDocumento();

  return (
    <ul className="grid gap-2" data-testid={testId}>
      {documentos.map((d) => (
        <li key={d.id} className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{d.nombre}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {d.proceso && <Badge variant="outline" className="max-w-full whitespace-normal text-left font-normal">{d.proceso}</Badge>}
                <span>Versión {d.version}</span>
                <span aria-hidden>·</span>
                <span>{formatearFecha(d.fecha)}</span>
              </div>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-11 w-full sm:h-9 sm:w-auto"
            disabled={descargando === d.id}
            aria-label={`Descargar ${d.nombre}`}
            onClick={() => void descargar(d.id, d.nombre)}
          >
            {descargando === d.id ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} Descargar
          </Button>
        </li>
      ))}
    </ul>
  );
}
