"use client";

import {
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalDistributeCenter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ElementoKonva, PosicionAlineacion } from "../../../domain/entities/disenador";

interface DisenadorPropiedadesGeometriaProps {
  elemento: ElementoKonva;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
  onAlinearElemento: (pos: PosicionAlineacion) => void;
}

export function DisenadorPropiedadesGeometria({
  elemento: el,
  onActualizarElemento,
  onAlinearElemento,
}: DisenadorPropiedadesGeometriaProps) {
  return (
    <>
      {/* Posición y Dimensiones en mm */}
      <div className="space-y-1.5 pt-2 border-t">
        <Label className="text-[11px] font-semibold text-muted-foreground">
          Posición y Tamaño (mm)
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-[10px] text-muted-foreground block">X (mm)</span>
            <Input
              type="number"
              step="0.5"
              className="h-7 text-xs font-mono"
              value={el.x}
              onChange={(e) =>
                onActualizarElemento(el.id, { x: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Y (mm)</span>
            <Input
              type="number"
              step="0.5"
              className="h-7 text-xs font-mono"
              value={el.y}
              onChange={(e) =>
                onActualizarElemento(el.id, { y: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Ancho (mm)</span>
            <Input
              type="number"
              step="0.5"
              className="h-7 text-xs font-mono"
              value={el.w}
              onChange={(e) =>
                onActualizarElemento(el.id, { w: parseFloat(e.target.value) || 1 })
              }
            />
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Alto (mm)</span>
            <Input
              type="number"
              step="0.5"
              className="h-7 text-xs font-mono"
              value={el.h}
              onChange={(e) =>
                onActualizarElemento(el.id, { h: parseFloat(e.target.value) || 1 })
              }
            />
          </div>
        </div>
      </div>

      {/* Herramientas de Alineación */}
      <div className="space-y-1.5 pt-2 border-t">
        <Label className="text-[11px] font-semibold text-muted-foreground">
          Alinear en el Carnet
        </Label>
        <div className="grid grid-cols-3 gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-1"
            onClick={() => onAlinearElemento("left")}
          >
            <AlignLeft className="size-3 mr-1" /> Izq
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-1"
            onClick={() => onAlinearElemento("center-h")}
          >
            <AlignHorizontalDistributeCenter className="size-3 mr-1" /> Cen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-1"
            onClick={() => onAlinearElemento("right")}
          >
            <AlignRight className="size-3 mr-1" /> Der
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-1"
            onClick={() => onAlinearElemento("top")}
          >
            Arriba
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-1"
            onClick={() => onAlinearElemento("center-v")}
          >
            <AlignVerticalDistributeCenter className="size-3 mr-1" /> Medio
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-1"
            onClick={() => onAlinearElemento("bottom")}
          >
            Abajo
          </Button>
        </div>
      </div>
    </>
  );
}
