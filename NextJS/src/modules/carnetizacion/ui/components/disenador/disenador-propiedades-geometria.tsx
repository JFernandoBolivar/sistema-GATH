"use client";

import {
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalDistributeCenter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampoNumerico, SeccionPropiedades } from "./disenador-campos";
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
      <SeccionPropiedades titulo="Posición y Tamaño">
        <div className="grid grid-cols-2 gap-2">
          <CampoNumerico
            etiqueta="X"
            sufijo="mm"
            step="0.5"
            value={el.x}
            onChange={(e) => onActualizarElemento(el.id, { x: parseFloat(e.target.value) || 0 })}
          />
          <CampoNumerico
            etiqueta="Y"
            sufijo="mm"
            step="0.5"
            value={el.y}
            onChange={(e) => onActualizarElemento(el.id, { y: parseFloat(e.target.value) || 0 })}
          />
          <CampoNumerico
            etiqueta="Ancho"
            sufijo="mm"
            step="0.5"
            value={el.w}
            onChange={(e) => onActualizarElemento(el.id, { w: parseFloat(e.target.value) || 1 })}
          />
          <CampoNumerico
            etiqueta="Alto"
            sufijo="mm"
            step="0.5"
            value={el.h}
            onChange={(e) => onActualizarElemento(el.id, { h: parseFloat(e.target.value) || 1 })}
          />
        </div>
      </SeccionPropiedades>

      {/* Herramientas de Alineación */}
      <SeccionPropiedades titulo="Alinear en el Carnet">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs px-1"
            onClick={() => onAlinearElemento("left")}
          >
            <AlignLeft className="size-3 mr-1" /> Izq
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs px-1"
            onClick={() => onAlinearElemento("center-h")}
          >
            <AlignHorizontalDistributeCenter className="size-3 mr-1" /> Cen
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs px-1"
            onClick={() => onAlinearElemento("right")}
          >
            <AlignRight className="size-3 mr-1" /> Der
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs px-1"
            onClick={() => onAlinearElemento("top")}
          >
            Arriba
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs px-1"
            onClick={() => onAlinearElemento("center-v")}
          >
            <AlignVerticalDistributeCenter className="size-3 mr-1" /> Medio
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs px-1"
            onClick={() => onAlinearElemento("bottom")}
          >
            Abajo
          </Button>
        </div>
      </SeccionPropiedades>
    </>
  );
}
