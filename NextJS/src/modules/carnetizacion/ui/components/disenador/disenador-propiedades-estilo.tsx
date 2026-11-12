"use client";

import { useRef } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ElementoKonva } from "../../../domain/entities/disenador";
import { SeccionPropiedades } from "./disenador-campos";

/** Paleta institucional base (azul marino, rojo, blanco, negro). */
const PALETA_INSTITUCIONAL = ["#14284b", "#c8102e", "#ffffff", "#111827"];

const COLORES_REGLA: { valor: string; etiqueta: string }[] = [
  { valor: "rule:primario", etiqueta: "Primario" },
  { valor: "rule:acento", etiqueta: "Acento" },
  { valor: "rule:texto", etiqueta: "Texto" },
];

interface DisenadorPropiedadesEstiloProps {
  elemento: ElementoKonva;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
  /** Colores propios que ya usa la plantilla, ofrecidos como muestras. */
  coloresPlantilla?: string[];
}

export function DisenadorPropiedadesEstilo({
  elemento: el,
  onActualizarElemento,
  coloresPlantilla = [],
}: DisenadorPropiedadesEstiloProps) {
  const selectorColorRef = useRef<HTMLInputElement>(null);
  const esRegla = el.fill.startsWith("rule:");
  const muestras = [
    ...new Set([...PALETA_INSTITUCIONAL, ...coloresPlantilla].map((c) => c.toLowerCase())),
  ];
  const tamano = el.size || 8;
  const cambiarTamano = (valor: number) =>
    onActualizarElemento(el.id, { size: Math.min(36, Math.max(3, Number(valor.toFixed(1)))) });

  const estilosActivos = [el.bold ? "bold" : "", el.ital ? "ital" : ""].filter(Boolean);

  return (
    <>
      {/* Tipografía (si aplica) */}
      {(el.t === "text" || el.t === "field") && (
        <SeccionPropiedades titulo="Tipografía">
          <Select
            value={el.font || "Source Sans 3, Arial"}
            onValueChange={(val) => onActualizarElemento(el.id, { font: val })}
          >
            <SelectTrigger className="h-9 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Source Sans 3, Arial">Source Sans 3</SelectItem>
              <SelectItem value="Arial">Arial</SelectItem>
              <SelectItem value="Georgia">Georgia</SelectItem>
              <SelectItem value="monospace">Monospace</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-wrap items-center gap-2">
            {/* Stepper de tamaño: − [ 8.5 pt ] + */}
            <div className="flex h-9 items-center rounded-md border border-input">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-full w-8 rounded-r-none"
                aria-label="Reducir tamaño"
                onClick={() => cambiarTamano(tamano - 0.5)}
              >
                <Minus className="size-3.5" />
              </Button>
              <div className="relative w-16">
                <Input
                  type="number"
                  step="0.5"
                  min="3"
                  max="36"
                  className="h-full rounded-none border-0 px-1 pr-6 text-center font-mono text-xs shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  value={tamano}
                  onChange={(e) =>
                    onActualizarElemento(el.id, { size: parseFloat(e.target.value) || 6 })
                  }
                />
                <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-[11px] text-muted-foreground">
                  pt
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-full w-8 rounded-l-none"
                aria-label="Aumentar tamaño"
                onClick={() => cambiarTamano(tamano + 0.5)}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>

            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              value={estilosActivos}
              onValueChange={(v) =>
                onActualizarElemento(el.id, { bold: v.includes("bold"), ital: v.includes("ital") })
              }
              className="h-9"
            >
              <ToggleGroupItem value="bold" aria-label="Negrita" className="h-9 w-9 px-0">
                <Bold className="size-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="ital" aria-label="Cursiva" className="h-9 w-9 px-0">
                <Italic className="size-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>

            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={el.align || "left"}
              onValueChange={(v) => {
                if (v === "left" || v === "center" || v === "right")
                  onActualizarElemento(el.id, { align: v });
              }}
              className="h-9"
            >
              <ToggleGroupItem value="left" aria-label="Alinear a la izquierda" className="h-9 w-9 px-0">
                <AlignLeft className="size-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="center" aria-label="Centrar" className="h-9 w-9 px-0">
                <AlignCenter className="size-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="right" aria-label="Alinear a la derecha" className="h-9 w-9 px-0">
                <AlignRight className="size-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </SeccionPropiedades>
      )}

      {/* Colores (propio o de regla) */}
      <SeccionPropiedades titulo="Color de Relleno">
        <div className="flex flex-wrap items-center gap-1.5">
          {muestras.map((color) => {
            const activo = !esRegla && el.fill.toLowerCase() === color;
            return (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={`Color ${color}`}
                aria-pressed={activo}
                onClick={() => onActualizarElemento(el.id, { fill: color })}
                className={`size-6 rounded-full border border-border transition-shadow ${
                  activo ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                }`}
                style={{ backgroundColor: color }}
              />
            );
          })}
          <button
            type="button"
            title="Color personalizado"
            aria-label="Color personalizado"
            onClick={() => selectorColorRef.current?.click()}
            className="flex size-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/60 text-muted-foreground hover:bg-muted"
          >
            <Plus className="size-3.5" />
          </button>
          <input
            ref={selectorColorRef}
            type="color"
            tabIndex={-1}
            aria-hidden
            className="sr-only"
            value={/^#[0-9a-f]{6}$/i.test(el.fill) ? el.fill : "#16264a"}
            onChange={(e) => onActualizarElemento(el.id, { fill: e.target.value })}
          />
        </div>

        {/* Colores de las reglas de la plantilla (cambian según la nómina del titular) */}
        <div className="flex flex-wrap gap-1.5">
          {COLORES_REGLA.map((r) => (
            <Button
              key={r.valor}
              type="button"
              size="sm"
              variant={el.fill === r.valor ? "secondary" : "outline"}
              className="h-9 flex-1 text-xs"
              onClick={() => onActualizarElemento(el.id, { fill: r.valor })}
              title={`${r.etiqueta} (Regla)`}
            >
              {r.etiqueta}
            </Button>
          ))}
        </div>

        {/* Campo único: cuadro de color integrado + hex */}
        {!esRegla && (
          <div className="relative">
            <input
              type="color"
              aria-label="Selector de color"
              value={/^#[0-9a-f]{6}$/i.test(el.fill) ? el.fill : "#16264a"}
              onChange={(e) => onActualizarElemento(el.id, { fill: e.target.value })}
              className="absolute left-2 top-1/2 size-5 -translate-y-1/2 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <Input
              className="h-9 pl-9 font-mono text-xs"
              value={el.fill}
              onChange={(e) => onActualizarElemento(el.id, { fill: e.target.value })}
            />
          </div>
        )}
      </SeccionPropiedades>

      {/* Opacidad y Sombra */}
      <SeccionPropiedades>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span>Opacidad</span>
              <span className="font-mono text-muted-foreground">{el.op ?? 100} %</span>
            </div>
            <Slider
              value={[el.op ?? 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([val]) => onActualizarElemento(el.id, { op: val })}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span>Sombra</span>
              <span className="font-mono text-muted-foreground">{el.shadow || 0}</span>
            </div>
            <Slider
              value={[el.shadow || 0]}
              min={0}
              max={6}
              step={0.5}
              onValueChange={([val]) => onActualizarElemento(el.id, { shadow: val })}
            />
          </div>

          {["rect", "photo", "qr"].includes(el.t) && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span>Radio de Esquinas</span>
                <span className="font-mono text-muted-foreground">{el.rad || 0} mm</span>
              </div>
              <Slider
                value={[el.rad || 0]}
                min={0}
                max={10}
                step={0.5}
                onValueChange={([val]) => onActualizarElemento(el.id, { rad: val })}
              />
            </div>
          )}
        </div>
      </SeccionPropiedades>
    </>
  );
}
