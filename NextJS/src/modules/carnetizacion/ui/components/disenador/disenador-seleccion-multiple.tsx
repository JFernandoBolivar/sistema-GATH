"use client";

import { AlignCenterHorizontal, AlignLeft, AlignRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  cantidad: number;
  onEliminar: () => void;
  onAlinear: (pos: "left" | "center-h" | "right") => void;
}

/** Inspector cuando hay varios elementos seleccionados: no edita propiedades individuales. */
export function DisenadorSeleccionMultiple({ cantidad, onEliminar, onAlinear }: Props) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-xs">
      <p className="text-sm font-semibold">{cantidad} elementos seleccionados</p>
      <p className="text-xs text-muted-foreground">
        Arrastre para moverlos juntos. Escape limpia la selección.
      </p>
      <div className="flex gap-1.5">
        <Button type="button" size="icon" variant="outline" className="size-8" title="Alinear izquierda" onClick={() => onAlinear("left")}>
          <AlignLeft className="size-4" />
        </Button>
        <Button type="button" size="icon" variant="outline" className="size-8" title="Alinear centro" onClick={() => onAlinear("center-h")}>
          <AlignCenterHorizontal className="size-4" />
        </Button>
        <Button type="button" size="icon" variant="outline" className="size-8" title="Alinear derecha" onClick={() => onAlinear("right")}>
          <AlignRight className="size-4" />
        </Button>
      </div>
      <Button type="button" size="sm" variant="destructive" className="w-full gap-1.5" onClick={onEliminar}>
        <Trash2 className="size-4" />
        Eliminar
      </Button>
    </div>
  );
}
