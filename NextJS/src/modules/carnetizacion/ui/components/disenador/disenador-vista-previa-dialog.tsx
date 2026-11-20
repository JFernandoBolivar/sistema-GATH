"use client";

import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CarasVistaPrevia {
  anverso: string;
  reverso: string | null;
}

interface DisenadorVistaPreviaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caras: CarasVistaPrevia | null;
  cargando: boolean;
}

/**
 * Vista previa generada por el MISMO motor PDF que emite el carnet (B-1): lo que se ve aquí es
 * lo que se imprime, a diferencia del lienzo del editor, que es solo una aproximación.
 */
export function DisenadorVistaPreviaDialog({
  open,
  onOpenChange,
  caras,
  cargando,
}: DisenadorVistaPreviaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Vista previa de impresión</DialogTitle>
          <DialogDescription>
            Generada con el motor PDF que emite los carnets, con los cambios actuales (aunque no estén
            guardados) y datos de ejemplo.
          </DialogDescription>
        </DialogHeader>
        {cargando || !caras ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Generando vista previa…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(
              [
                ["Anverso", caras.anverso],
                ["Reverso", caras.reverso],
              ] as const
            ).map(([cara, src]) => (
              <figure key={cara} className="flex flex-col items-center gap-2">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`Vista previa de impresión: ${cara.toLowerCase()}`}
                    className="max-h-96 w-auto rounded-lg border border-border shadow-sm"
                  />
                ) : (
                  <div className="flex h-72 w-44 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                    Sin {cara.toLowerCase()}
                  </div>
                )}
                <figcaption className="text-xs font-medium text-muted-foreground">{cara}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
