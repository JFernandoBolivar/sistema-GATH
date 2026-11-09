"use client";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ElementoBiblioteca } from "../../../domain/entities/carnet";
import type { ElementoKonva } from "../../../domain/entities/disenador";

interface DisenadorBibliotecaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediosBiblioteca: ElementoBiblioteca[];
  caraActual: "anverso" | "reverso";
  onAnadirElemento: (nuevo: Omit<ElementoKonva, "id">) => void;
}

export function DisenadorBibliotecaDialog({
  open,
  onOpenChange,
  mediosBiblioteca,
  caraActual,
  onAnadirElemento,
}: DisenadorBibliotecaDialogProps) {
  const handleSeleccionarMedio = (medio: ElementoBiblioteca) => {
    onAnadirElemento({
      t: "image",
      name: medio.nombre,
      cara: caraActual,
      src: medio.archivo_url,
      biblioteca_id: medio.id,
      x: 10,
      y: 10,
      w: 25,
      h: 15,
      r: 0,
      fill: "",
      stroke: "",
      sw: 0,
      rad: 0,
      shadow: 0,
      op: 100,
    });
    onOpenChange(false);
    toast.success(`'${medio.nombre}' insertado en la credencial.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Insertar Recurso de la Biblioteca</DialogTitle>
          <DialogDescription>
            Selecciona un logo, firma o imagen institucional para colocar en la credencial.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto p-1">
          {mediosBiblioteca.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
              No hay medios registrados. Sube recursos en la pestaña «Biblioteca de Medios».
            </div>
          ) : (
            mediosBiblioteca.map((medio) => (
              <div
                key={medio.id}
                onClick={() => handleSeleccionarMedio(medio)}
                className="p-2 border rounded-lg cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-all flex flex-col items-center justify-between text-center gap-1.5"
              >
                <div className="h-16 w-full flex items-center justify-center p-1 bg-muted/20 rounded">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={medio.archivo_url}
                    alt={medio.nombre}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span className="text-[11px] font-medium truncate w-full">{medio.nombre}</span>
                <Badge variant="outline" className="text-[9px] uppercase">
                  {medio.categoria}
                </Badge>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
