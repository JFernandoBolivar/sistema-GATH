"use client";

import { Palette, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CriterioColor, ReglasColorConfig } from "../../../domain/entities/disenador";
import { REGLAS_COLOR_DEFECTO } from "../../../domain/entities/disenador";

interface DisenadorReglasColorPanelProps {
  reglasColor: ReglasColorConfig;
  onActualizarReglasColor: (
    actualizar: ReglasColorConfig | ((prev: ReglasColorConfig) => ReglasColorConfig)
  ) => void;
  nuevoValorNombre: string;
  onCambiarNuevoValorNombre: (valor: string) => void;
}

export function DisenadorReglasColorPanel({
  reglasColor,
  onActualizarReglasColor,
  nuevoValorNombre,
  onCambiarNuevoValorNombre,
}: DisenadorReglasColorPanelProps) {
  const handleAnadirValor = () => {
    if (!nuevoValorNombre.trim()) return;
    onActualizarReglasColor((prev) => ({
      ...prev,
      valores: {
        ...prev.valores,
        [nuevoValorNombre.trim()]: {
          primario: "#1f3a5f",
          acento: "#1273bd",
          texto: "#ffffff",
        },
      },
    }));
    onCambiarNuevoValorNombre("");
    toast.success(`Regla para '${nuevoValorNombre.trim()}' agregada.`);
  };

  const handleEliminarValor = (clave: string) => {
    onActualizarReglasColor((prev) => {
      const copia = { ...prev.valores };
      delete copia[clave];
      return { ...prev, valores: copia };
    });
  };

  return (
    <Card className="shadow-xs border">
      <CardHeader className="p-3 pb-2 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <Palette className="size-4 text-primary" />
          Reglas de Color (O44 - E7)
        </CardTitle>
        <p className="text-[11px] text-muted-foreground leading-tight">
          Configura si los colores del carnet cambian por nómina, cargo, oficina o valor único.
        </p>
      </CardHeader>
      <CardContent className="p-3 space-y-4 text-xs">
        {/* Selector de Criterio */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold">Criterio de Color</Label>
          <Select
            value={reglasColor.criterio}
            onValueChange={(val: CriterioColor) =>
              onActualizarReglasColor((prev) => ({ ...prev, criterio: val }))
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unico">Un solo color para todos (Único)</SelectItem>
              <SelectItem value="nomina">Por Tipo de Nómina</SelectItem>
              <SelectItem value="cargo">Por Cargo del Titular</SelectItem>
              <SelectItem value="oficina">Por Oficina / Dependencia</SelectItem>
              <SelectItem value="nivel">Por Nivel Jerárquico</SelectItem>
              <SelectItem value="otro">Otro Catálogo Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Color de Respaldo Institucional (Fallback) */}
        <div className="space-y-2 p-2.5 rounded-lg border bg-muted/10">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-[11px] text-foreground">
              Color de Respaldo (Fallback)
            </span>
            <Badge variant="outline" className="text-[9px]">
              Institucional
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Aplica si el titular no tiene valor tabulado o si el criterio es único.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Primario</span>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  className="size-6 rounded border cursor-pointer p-0 shrink-0"
                  value={reglasColor.respaldo.primario}
                  onChange={(e) =>
                    onActualizarReglasColor((prev) => ({
                      ...prev,
                      respaldo: { ...prev.respaldo, primario: e.target.value },
                    }))
                  }
                />
                <span className="text-[10px] font-mono">{reglasColor.respaldo.primario}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Acento</span>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  className="size-6 rounded border cursor-pointer p-0 shrink-0"
                  value={reglasColor.respaldo.acento}
                  onChange={(e) =>
                    onActualizarReglasColor((prev) => ({
                      ...prev,
                      respaldo: { ...prev.respaldo, acento: e.target.value },
                    }))
                  }
                />
                <span className="text-[10px] font-mono">{reglasColor.respaldo.acento}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Texto</span>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  className="size-6 rounded border cursor-pointer p-0 shrink-0"
                  value={reglasColor.respaldo.texto}
                  onChange={(e) =>
                    onActualizarReglasColor((prev) => ({
                      ...prev,
                      respaldo: { ...prev.respaldo, texto: e.target.value },
                    }))
                  }
                />
                <span className="text-[10px] font-mono">{reglasColor.respaldo.texto}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de Valores según el Criterio */}
        {reglasColor.criterio !== "unico" && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex justify-between items-center">
              <Label className="text-[11px] font-semibold">
                Valores tabulados ({reglasColor.criterio})
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {Object.keys(reglasColor.valores).length} configurados
              </span>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {Object.entries(reglasColor.valores).map(([clave, cols]) => (
                <div
                  key={clave}
                  className="p-1.5 rounded border bg-card flex items-center justify-between gap-1 text-[11px]"
                >
                  <span className="font-medium truncate max-w-[120px]" title={clave}>
                    {clave}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1" title="Color Primario">
                      <input
                        type="color"
                        className="size-5 rounded border cursor-pointer p-0"
                        value={cols.primario}
                        onChange={(e) => {
                          const val = e.target.value;
                          onActualizarReglasColor((prev) => ({
                            ...prev,
                            valores: {
                              ...prev.valores,
                              [clave]: { ...cols, primario: val },
                            },
                          }));
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1" title="Color de Acento">
                      <input
                        type="color"
                        className="size-5 rounded border cursor-pointer p-0"
                        value={cols.acento}
                        onChange={(e) => {
                          const val = e.target.value;
                          onActualizarReglasColor((prev) => ({
                            ...prev,
                            valores: {
                              ...prev.valores,
                              [clave]: { ...cols, acento: val },
                            },
                          }));
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-5 text-muted-foreground hover:text-destructive"
                      onClick={() => handleEliminarValor(clave)}
                      title="Quitar regla"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Agregar nuevo valor de regla */}
            <div className="flex items-center gap-1 pt-1">
              <Input
                placeholder="Nuevo valor (ej. Pasante)"
                className="h-7 text-xs"
                value={nuevoValorNombre}
                onChange={(e) => onCambiarNuevoValorNombre(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-[11px] px-2 shrink-0"
                onClick={handleAnadirValor}
              >
                <Plus className="size-3 mr-1" /> Añadir
              </Button>
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs text-muted-foreground"
            onClick={() => {
              onActualizarReglasColor(REGLAS_COLOR_DEFECTO);
              toast.info(
                "Reglas restablecidas a los valores institucionales (Funcionario azul marino)."
              );
            }}
          >
            Restablecer reglas iniciales
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
