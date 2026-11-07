"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { ElementoKonva } from "../../../domain/entities/disenador";

interface DisenadorPropiedadesEstiloProps {
  elemento: ElementoKonva;
  onActualizarElemento: (id: string, cambios: Partial<ElementoKonva>) => void;
}

export function DisenadorPropiedadesEstilo({
  elemento: el,
  onActualizarElemento,
}: DisenadorPropiedadesEstiloProps) {
  return (
    <>
      {/* Tipografía (si aplica) */}
      {(el.t === "text" || el.t === "field") && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-[11px] font-semibold text-muted-foreground">Tipografía</Label>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={el.font || "Source Sans 3, Arial"}
              onValueChange={(val) => onActualizarElemento(el.id, { font: val })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Source Sans 3, Arial">Source Sans 3</SelectItem>
                <SelectItem value="Arial">Arial</SelectItem>
                <SelectItem value="Georgia">Georgia</SelectItem>
                <SelectItem value="monospace">Monospace</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.5"
                min="3"
                max="36"
                className="h-7 text-xs font-mono"
                value={el.size || 8}
                onChange={(e) =>
                  onActualizarElemento(el.id, { size: parseFloat(e.target.value) || 6 })
                }
              />
              <span className="text-[10px] text-muted-foreground">pt</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant={el.bold ? "default" : "outline"}
              size="icon"
              className="size-7"
              onClick={() => onActualizarElemento(el.id, { bold: !el.bold })}
            >
              <Bold className="size-3.5" />
            </Button>
            <Button
              variant={el.ital ? "default" : "outline"}
              size="icon"
              className="size-7"
              onClick={() => onActualizarElemento(el.id, { ital: !el.ital })}
            >
              <Italic className="size-3.5" />
            </Button>
            <div className="flex items-center border rounded p-0.5 ml-auto">
              <Button
                variant={el.align === "left" ? "secondary" : "ghost"}
                size="icon"
                className="size-6"
                onClick={() => onActualizarElemento(el.id, { align: "left" })}
              >
                <AlignLeft className="size-3" />
              </Button>
              <Button
                variant={el.align === "center" ? "secondary" : "ghost"}
                size="icon"
                className="size-6"
                onClick={() => onActualizarElemento(el.id, { align: "center" })}
              >
                <AlignCenter className="size-3" />
              </Button>
              <Button
                variant={el.align === "right" ? "secondary" : "ghost"}
                size="icon"
                className="size-6"
                onClick={() => onActualizarElemento(el.id, { align: "right" })}
              >
                <AlignRight className="size-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Colores (Propio o de Regla) */}
      <div className="space-y-2 pt-2 border-t">
        <Label className="text-[11px] font-semibold text-muted-foreground">Color de Relleno</Label>
        <Select
          value={el.fill.startsWith("rule:") ? el.fill : "propio"}
          onValueChange={(val) => {
            if (val === "propio") {
              onActualizarElemento(el.id, { fill: "#16264a" });
            } else {
              onActualizarElemento(el.id, { fill: val });
            }
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="propio">Color Personalizado</SelectItem>
            <SelectItem value="rule:primario">Color Primario (Regla)</SelectItem>
            <SelectItem value="rule:acento">Color de Acento (Regla)</SelectItem>
            <SelectItem value="rule:texto">Color de Texto (Regla)</SelectItem>
          </SelectContent>
        </Select>

        {!el.fill.startsWith("rule:") && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={el.fill}
              onChange={(e) => onActualizarElemento(el.id, { fill: e.target.value })}
              className="size-7 rounded cursor-pointer border p-0.5"
            />
            <Input
              className="h-7 text-xs font-mono"
              value={el.fill}
              onChange={(e) => onActualizarElemento(el.id, { fill: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* Opacidad y Sombra */}
      <div className="space-y-3 pt-2 border-t">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span>Opacidad</span>
            <span className="font-mono">{el.op ?? 100}%</span>
          </div>
          <Slider
            value={[el.op ?? 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([val]) => onActualizarElemento(el.id, { op: val })}
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span>Sombra</span>
            <span className="font-mono">{el.shadow || 0}</span>
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
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span>Radio de Esquinas</span>
              <span className="font-mono">{el.rad || 0} mm</span>
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
    </>
  );
}
