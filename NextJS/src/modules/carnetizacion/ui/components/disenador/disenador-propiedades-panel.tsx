"use client";

import { AlertTriangle, Copy, Shapes, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CampoCredencial, ElementoBiblioteca } from "../../../domain/entities/carnet";
import {
  ladoQrMasGrandeMm,
  QR_MINIMO_MM_DEFECTO,
  qrInsuficiente,
  type ElementoKonva,
  type PosicionAlineacion,
} from "../../../domain/entities/disenador";
import { DisenadorPropiedadesGeometria } from "./disenador-propiedades-geometria";
import { DisenadorPropiedadesEstilo } from "./disenador-propiedades-estilo";
import { DisenadorQrEstilo } from "./disenador-qr-estilo";
import {
  DisenadorPropiedadesForma,
  TIPOS_CON_FORMA,
  type ControlForma,
} from "./disenador-propiedades-forma";

/** Colores propios (hex) que ya usa la plantilla, sin repetir, para ofrecerlos como muestras. */
function coloresPlantilla(elementos: readonly ElementoKonva[]): string[] {
  const vistos = new Set<string>();
  for (const e of elementos) {
    if (/^#[0-9a-f]{6}$/i.test(e.fill)) vistos.add(e.fill.toLowerCase());
  }
  return [...vistos].slice(0, 8);
}

interface DisenadorPropiedadesPanelProps {
  elementoSeleccionado: ElementoKonva | null;
  /** Todos los elementos de la plantilla (ambas caras), para el aviso del QR legible. */
  elementos: readonly ElementoKonva[];
  campoSeleccionadoMeta: CampoCredencial | null;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
  onDuplicarElemento: () => void;
  onEliminarElemento: () => void;
  onAlinearElemento: (pos: PosicionAlineacion) => void;
  /** Biblioteca de Medios: de ahí salen los logos que se pueden poner en el centro del QR. */
  mediosBiblioteca?: readonly ElementoBiblioteca[];
  /** Modo «Editar puntos» de las formas (radios, vértices). */
  controlForma?: ControlForma;
}

export function DisenadorPropiedadesPanel({
  elementoSeleccionado,
  elementos,
  campoSeleccionadoMeta,
  onActualizarElemento,
  onDuplicarElemento,
  onEliminarElemento,
  onAlinearElemento,
  mediosBiblioteca = [],
  controlForma,
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

      <CardContent className="space-y-3 p-3 text-xs">
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

        {/* Aviso: ningún QR alcanza el tamaño legible con teléfono (SILOG) */}
        {el.t === "qr" && qrInsuficiente(elementos) && (
          <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 flex items-start gap-1.5">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="text-[11px] leading-tight">
              Ningún QR mide {QR_MINIMO_MM_DEFECTO} × {QR_MINIMO_MM_DEFECTO} mm o más (el más grande mide{" "}
              {Math.round(ladoQrMasGrandeMm(elementos) * 10) / 10} mm). Sin eso no se podrá publicar la
              plantilla: SILOG no podría leerlo con un teléfono.
            </p>
          </div>
        )}

        {/* Nombre de la capa */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">Nombre de capa</Label>
          <Input
            className="h-9 text-xs"
            value={el.name}
            onChange={(e) => onActualizarElemento(el.id, { name: e.target.value })}
          />
        </div>

        {/* Si es Texto */}
        {el.t === "text" && (
          <div className="space-y-1">
            <Label className="text-xs font-medium">Texto</Label>
            <Input
              className="h-9 text-xs"
              value={el.text || ""}
              onChange={(e) => onActualizarElemento(el.id, { text: e.target.value })}
            />
          </div>
        )}

        {/* Forma: radio por esquina, «Editar puntos» y código SVG avanzado */}
        {TIPOS_CON_FORMA.includes(el.t as (typeof TIPOS_CON_FORMA)[number]) && (
          <DisenadorPropiedadesForma
            elemento={el}
            control={controlForma}
            onActualizarElemento={onActualizarElemento}
          />
        )}

        {/* Coordenadas, Dimensiones y Alineación */}
        <DisenadorPropiedadesGeometria
          elemento={el}
          onActualizarElemento={onActualizarElemento}
          onAlinearElemento={onAlinearElemento}
        />

        {/* Estilo del QR: forma, colores, ojos y logo (se guarda en props.qr_estilo) */}
        {el.t === "qr" && (
          <DisenadorQrEstilo
            elemento={el}
            onActualizarElemento={onActualizarElemento}
            mediosBiblioteca={mediosBiblioteca}
          />
        )}

        {/* Tipografía, Colores, Opacidad y Sombra */}
        <DisenadorPropiedadesEstilo
          elemento={el}
          onActualizarElemento={onActualizarElemento}
          coloresPlantilla={coloresPlantilla(elementos)}
        />
      </CardContent>
    </Card>
  );
}
