import {
  COLOR_ACENTO_INSTITUCIONAL,
  COLOR_PRIMARIO_INSTITUCIONAL,
} from "../../../domain/entities/formas-institucionales";

/** Color de dibujo de una miniatura: las reglas de color usan los colores de respaldo. */
export function colorParaMiniatura(fill: string): string {
  if (fill === "rule:primario") return COLOR_PRIMARIO_INSTITUCIONAL;
  if (fill === "rule:acento") return COLOR_ACENTO_INSTITUCIONAL;
  if (fill.startsWith("rule:")) return "#ffffff";
  return fill || "#94a3b8";
}

interface MiniaturaFormaProps {
  /** Path SVG en la caja 0..100. */
  path: string;
  color: string;
  /** Lado mayor de la miniatura en px. */
  tamano?: number;
  /** Proporción ancho / alto del elemento, para no deformar la miniatura. */
  proporcion?: number;
  className?: string;
}

/** Vista reducida de una forma SVG (la misma caja 0..100 que usan el editor y el PDF). */
export function MiniaturaForma({
  path,
  color,
  tamano = 48,
  proporcion = 1,
  className,
}: MiniaturaFormaProps) {
  const ancho = proporcion >= 1 ? tamano : tamano * proporcion;
  const alto = proporcion >= 1 ? tamano / proporcion : tamano;
  return (
    <svg
      role="img"
      aria-hidden
      width={ancho}
      height={alto}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
    >
      <path d={path} fill={color} stroke="#94a3b8" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
