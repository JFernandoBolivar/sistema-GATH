"use client";

import { AlertTriangle, Copy, Shapes, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CampoCredencial } from "../../../domain/entities/carnet";
import type { ElementoKonva, PosicionAlineacion } from "../../../domain/entities/disenador";
import { DisenadorPropiedadesGeometria } from "./disenador-propiedades-geometria";
import { DisenadorPropiedadesEstilo } from "./disenador-propiedades-estilo";

interface DisenadorPropiedadesPanelProps {
  elementoSeleccionado: ElementoKonva | null;
  campoSeleccionadoMeta: CampoCredencial | null;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
  onDuplicarElemento: () => void;
  onEliminarElemento: () => void;
  onAlinearElemento: (pos: PosicionAlineacion) => void;
}

export function DisenadorPropiedadesPanel({
  elementoSeleccionado,
  campoSeleccionadoMeta,
  onActualizarElemento,
  onDuplicarElemento,
  onEliminarElemento,
  onAlinearElemento,
}: DisenadorPropiedadesPanelProps) {
  if (!elementoSeleccionado) {
    return (
      <Card className="shadow-xs border p-4 text-center">
        <Shapes className="size-8 text-muted-foreground/40 mx-auto" />
        <h4 className="font-semibold text-xs mt-2">Ningún elemento seleccionado</h4>
        <p className="text-[11px] text-muted-foreground mt-1">
          Haz clic en una capa o elemento del carnet para editar su posición, tamaño, letra o colores.
        </p>
      </Card>
    );
  }

  const el = elementoSeleccionado;

  return (
    <Card className="shadow-xs border">
      <CardHeader className="p-3 pb-2 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold truncate">{el.name}</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onDuplicarElemento}
            title="Duplicar"
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:bg-destructive/10"
            onClick={onEliminarElemento}
            title="Eliminar"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-4 text-xs">
        {/* Banner de Aviso de Dato Sensible */}
        {campoSeleccionadoMeta?.sensible && (
          <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 flex items-start gap-1.5">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="text-[11px] leading-tight">
              <span className="font-semibold">Dato sensible:</span> {campoSeleccionadoMeta.etiqueta}{" "}
              quedará impreso y legible a simple vista.
            </p>
          </div>
        )}

        {/* Nombre de la capa */}
        <div className="space-y-1">
          <Label className="text-[11px]">Nombre de capa</Label>
          <Input
            className="h-7 text-xs"
            value={el.name}
            onChange={(e) => onActualizarElemento(el.id, { name: e.target.value })}
          />
        </div>

        {/* Si es Texto */}
        {el.t === "text" && (
          <div className="space-y-1">
            <Label className="text-[11px]">Texto</Label>
            <Input
              className="h-7 text-xs"
              value={el.text || ""}
              onChange={(e) => onActualizarElemento(el.id, { text: e.target.value })}
            />
          </div>
        )}

        {/* Forma libre: SVG path normalizado en una caja de 0..100 */}
        {el.t === "path" && (
          <div className="space-y-1">
            <Label className="text-[11px]">Forma SVG (caja 0–100)</Label>
            <textarea
              className="w-full min-h-24 rounded-md border border-input bg-background p-2 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
              value={el.path || ""}
              onChange={(e) => onActualizarElemento(el.id, { path: e.target.value })}
              placeholder="M 0 0 H 100 V 40 C 70 60 30 20 0 50 Z"
              spellCheck={false}
            />
            <p className="text-[10px] text-muted-foreground">
              Comandos M, L, H, V, C, Q y Z. Se escala al ancho y alto del elemento.
            </p>
          </div>
        )}

        {/* Coordenadas, Dimensiones y Alineación */}
        <DisenadorPropiedadesGeometria
          elemento={el}
          onActualizarElemento={onActualizarElemento}
          onAlinearElemento={onAlinearElemento}
        />

        {/* Tipografía, Colores, Opacidad y Sombra */}
        <DisenadorPropiedadesEstilo
          elemento={el}
          onActualizarElemento={onActualizarElemento}
        />
      </CardContent>
    </Card>
  );
}
