"use client";

import { Loader2, RotateCw, Search, Undo2, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PersonaMuestra } from "../../../domain/entities/disenador";

interface DisenadorToolbarProps {
  caraActual: "anverso" | "reverso";
  onCambiarCara: (cara: "anverso" | "reverso") => void;
  onDeshacer: () => void;
  onRehacer: () => void;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  escala: number;
  onCambiarEscala: (nuevaEscala: number | ((prev: number) => number)) => void;
  modoPreviewReal: boolean;
  datosPersona: PersonaMuestra;
  cedulaBusqueda: string;
  onCambiarCedulaBusqueda: (cedula: string) => void;
  buscandoCedula: boolean;
  onBuscarPersonaReal: (e: React.FormEvent) => void;
  onRestaurarPersonaFicticia: () => void;
}

export function DisenadorToolbar({
  caraActual,
  onCambiarCara,
  onDeshacer,
  onRehacer,
  puedeDeshacer,
  puedeRehacer,
  escala,
  onCambiarEscala,
  modoPreviewReal,
  datosPersona,
  cedulaBusqueda,
  onCambiarCedulaBusqueda,
  buscandoCedula,
  onBuscarPersonaReal,
  onRestaurarPersonaFicticia,
}: DisenadorToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-card shadow-xs mb-4">
      {/* Selector de Cara */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground mr-1">Cara:</span>
        <Button
          variant={caraActual === "anverso" ? "default" : "outline"}
          size="sm"
          onClick={() => onCambiarCara("anverso")}
        >
          Anverso (Frente)
        </Button>
        <Button
          variant={caraActual === "reverso" ? "default" : "outline"}
          size="sm"
          onClick={() => onCambiarCara("reverso")}
        >
          Reverso (Dorso)
        </Button>
      </div>

      {/* Deshacer / Rehacer */}
      <div className="flex items-center gap-1 border-x px-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onDeshacer}
          disabled={!puedeDeshacer}
          title="Deshacer (Ctrl+Z)"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onRehacer}
          disabled={!puedeRehacer}
          title="Rehacer (Ctrl+Y)"
        >
          <RotateCw className="size-4" />
        </Button>
      </div>

      {/* Zoom y Escala */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onCambiarEscala((e) => Math.max(2, e - 0.5))}
          title="Alejar"
        >
          <ZoomOut className="size-4" />
        </Button>
        <span className="text-xs font-mono w-14 text-center">
          {Math.round((escala / 4.2) * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onCambiarEscala((e) => Math.min(8, e + 0.5))}
          title="Acercar"
        >
          <ZoomIn className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8"
          onClick={() => onCambiarEscala(4.2)}
        >
          100%
        </Button>
      </div>

      {/* Selector de Vista Previa (Ficticia vs Real) */}
      <div className="flex items-center gap-2">
        {modoPreviewReal ? (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded border border-emerald-300 text-xs">
            <span className="truncate max-w-[150px] font-medium">{datosPersona.nombre}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1 text-[11px] text-destructive hover:bg-destructive/10"
              onClick={onRestaurarPersonaFicticia}
            >
              Volver a ficticios
            </Button>
          </div>
        ) : (
          <form onSubmit={onBuscarPersonaReal} className="flex items-center gap-1.5">
            <Input
              placeholder="Cédula para prueba real..."
              value={cedulaBusqueda}
              onChange={(e) => onCambiarCedulaBusqueda(e.target.value)}
              className="h-8 text-xs w-44"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              disabled={buscandoCedula}
            >
              {buscandoCedula ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Search className="size-3" />
              )}
              Buscar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
