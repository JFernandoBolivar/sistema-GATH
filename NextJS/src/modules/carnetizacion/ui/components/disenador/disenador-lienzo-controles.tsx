/**
 * Controles de zoom superpuestos sobre el lienzo del diseñador.
 * Permite alejar, acercar, ver el porcentaje y ajustar al contenedor.
 * Se llama desde DisenadorView (escritorio y móvil).
 */
"use client";

import { Minus, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DisenadorLienzoControlesProps {
  /** Escala actual en px/mm. */
  escala: number;
  /** Setter de escala del editor. */
  onCambiarEscala: (nuevaEscala: number | ((prev: number) => number)) => void;
  /** Se pulsó «Ajustar»: la vista reactiva el modo de ajuste automático. */
  onAjustar: () => void;
  /** Táctil (móvil): botones de 44 px en lugar de 36 px. */
  tactil?: boolean;
  /** Disposición en columna (móvil), para no tapar el carnet. */
  vertical?: boolean;
  /** Límites de escala en px/mm. */
  minEscala?: number;
  maxEscala?: number;
}

/** Escala base de referencia (4.2 px/mm ≈ 100% original). */
const ESCALA_BASE = 4.2;
const MIN_ESCALA_DEFECTO = 1.5;
const MAX_ESCALA_DEFECTO = 12;

/**
 * Calcula la escala de ajuste automático para que el carnet quepa en el contenedor
 * con un margen perimetral en px.
 */
export function calcularEscalaAjuste(
  anchoContenedorPx: number,
  altoContenedorPx: number,
  anchoMm: number,
  altoMm: number,
  margenPx = 32,
): number {
  if (anchoContenedorPx <= 0 || altoContenedorPx <= 0 || anchoMm <= 0 || altoMm <= 0) {
    return ESCALA_BASE;
  }
  const escalaH = (anchoContenedorPx - margenPx * 2) / anchoMm;
  const escalaV = (altoContenedorPx - margenPx * 2) / altoMm;
  return Math.max(MIN_ESCALA_DEFECTO, Math.min(MAX_ESCALA_DEFECTO, Math.min(escalaH, escalaV)));
}

export function DisenadorLienzoControles({
  escala,
  onCambiarEscala,
  onAjustar,
  tactil = false,
  vertical = false,
  minEscala = MIN_ESCALA_DEFECTO,
  maxEscala = MAX_ESCALA_DEFECTO,
}: DisenadorLienzoControlesProps) {
  const porcentaje = Math.round((escala / ESCALA_BASE) * 100);

  const alejar = () =>
    onCambiarEscala((e) => Math.max(minEscala, parseFloat((e - 0.5).toFixed(2))));
  const acercar = () =>
    onCambiarEscala((e) => Math.min(maxEscala, parseFloat((e + 0.5).toFixed(2))));
  const tamanoBoton = tactil ? "size-11" : "size-9";

  return (
    <div
      role="group"
      className={cn(
        "flex items-center gap-1 rounded-md border bg-background/90 shadow-sm backdrop-blur-sm px-1 py-0.5",
        vertical && "flex-col",
      )}
      aria-label="Controles de zoom del lienzo"
    >
      {/* Botón Alejar */}
      <Button
        variant="ghost"
        size="icon"
        className={tamanoBoton}
        onClick={alejar}
        disabled={escala <= minEscala}
        aria-label="Alejar zoom"
        title="Alejar (−)"
      >
        <Minus className="size-4" aria-hidden />
      </Button>

      {/* Porcentaje actual */}
      <span
        className={cn("text-xs font-mono text-center select-none", vertical ? "w-11" : "w-12")}
        role="status"
        aria-label={`Zoom al ${porcentaje} por ciento`}
      >
        {porcentaje}%
      </span>

      {/* Botón Acercar */}
      <Button
        variant="ghost"
        size="icon"
        className={tamanoBoton}
        onClick={acercar}
        disabled={escala >= maxEscala}
        aria-label="Acercar zoom"
        title="Acercar (+)"
      >
        <Plus className="size-4" aria-hidden />
      </Button>

      {/* Ajustar al contenedor */}
      <Button
        variant="ghost"
        size="icon"
        className={tamanoBoton}
        onClick={onAjustar}
        aria-label="Ajustar lienzo al contenedor"
        title="Ajustar al contenedor"
      >
        <Maximize2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
