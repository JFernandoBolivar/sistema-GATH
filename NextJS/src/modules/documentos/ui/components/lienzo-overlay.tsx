"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Maximize2, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CampoOverlay, GeometriaCampo } from "../../domain/entities/plantilla";
import {
  arrastrarCampo,
  empujarCampo,
  limitarZoom,
  mmAPx,
  redimensionarCampo,
  rectanguloEnPx,
  zoomParaAncho,
  type AsaRedimension,
  type DimensionPagina,
} from "../../domain/lib/lienzo";
import { resumenCampo } from "../../domain/lib/resumen";

const PX_POR_MM_100 = 96 / 25.4; // 100 % = 96 ppp
const PT_A_MM = 25.4 / 72;

interface Props {
  pagina: DimensionPagina;
  imagenUrl: string | null;
  campos: CampoOverlay[];
  seleccionadoId: string | null;
  conErrorIds: Set<string>;
  soloLectura: boolean;
  onSeleccionar: (id: string | null) => void;
  onCambiarGeometria: (id: string, g: GeometriaCampo) => void;
  onEliminar: (id: string) => void;
}

interface Gesto {
  id: string;
  accion: "mover" | AsaRedimension;
  x0: number;
  y0: number;
  inicial: GeometriaCampo;
}

const ASAS: { asa: AsaRedimension; clase: string; cursor: string }[] = [
  { asa: "no", clase: "-left-2 -top-2", cursor: "cursor-nwse-resize" },
  { asa: "n", clase: "left-1/2 -top-2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { asa: "ne", clase: "-right-2 -top-2", cursor: "cursor-nesw-resize" },
  { asa: "o", clase: "-left-2 top-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { asa: "e", clase: "-right-2 top-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { asa: "so", clase: "-bottom-2 -left-2", cursor: "cursor-nesw-resize" },
  { asa: "s", clase: "-bottom-2 left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { asa: "se", clase: "-bottom-2 -right-2", cursor: "cursor-nwse-resize" },
];

const ESTILO_TIPO: Record<CampoOverlay["tipo"], string> = {
  texto: "border-sky-500 bg-sky-500/15",
  casilla: "border-amber-500 bg-amber-500/20",
  foto: "border-emerald-500 bg-emerald-500/15",
  tabla: "border-violet-500 bg-violet-500/10",
};

function ContenidoCampo({ campo, zoom }: { campo: CampoOverlay; zoom: number }) {
  if (campo.tipo === "texto") {
    return (
      <span
        className="block h-full w-full overflow-hidden whitespace-pre-wrap leading-tight text-sky-950 dark:text-sky-100"
        style={{
          fontSize: campo.tamano * PT_A_MM * zoom,
          fontWeight: campo.negrita ? 700 : 400,
          textAlign: campo.alineacion === "centro" ? "center" : campo.alineacion === "derecha" ? "right" : "left",
        }}
      >
        {campo.texto}
      </span>
    );
  }
  if (campo.tipo === "casilla") {
    return <span className="flex h-full w-full items-center justify-center font-bold text-amber-700" style={{ fontSize: Math.max(8, campo.h * zoom * 0.8) }}>X</span>;
  }
  if (campo.tipo === "foto") {
    return <ImageIcon className="m-auto size-1/2 text-emerald-700" aria-hidden />;
  }
  return (
    <>
      {campo.columnas.map((c, i) => (
        <span
          key={i}
          className="absolute top-0 h-full overflow-hidden border-l border-violet-400 pl-0.5 text-[10px] leading-none text-violet-900 dark:text-violet-200"
          style={{ left: mmAPx(c.dx, zoom), width: mmAPx(c.ancho, zoom) }}
        >
          {c.variable}
        </span>
      ))}
      {Array.from({ length: Math.min(campo.filas_max, 60) }, (_, i) => (
        <span key={i} className="absolute inset-x-0 border-t border-violet-300/70" style={{ top: mmAPx(campo.interlineado * (i + 1), zoom) }} />
      ))}
    </>
  );
}

/**
 * Lienzo con el PNG de la página como fondo y los campos como rectángulos que se arrastran y
 * redimensionan con Pointer Events (ratón y táctil). Zoom: ajustar al ancho, +/- y Ctrl+rueda.
 * Teclado: flechas empujan 0,5 mm (Shift = 5 mm), Supr elimina, Esc deselecciona.
 */
export function LienzoOverlay({ pagina, imagenUrl, campos, seleccionadoId, conErrorIds, soloLectura, onSeleccionar, onCambiarGeometria, onEliminar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [anchoDisponible, setAnchoDisponible] = useState(0);
  const [zoomManual, setZoomManual] = useState<number | null>(null);
  const gesto = useRef<Gesto | null>(null);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const medir = () => setAnchoDisponible(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomAjuste = limitarZoom(zoomParaAncho(anchoDisponible - 24, pagina.ancho_mm));
  const zoom = zoomManual ?? zoomAjuste;
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  });

  // Ctrl + rueda: zoom (listener no pasivo para poder cancelar el zoom del navegador).
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const alRueda = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoomManual(limitarZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    };
    el.addEventListener("wheel", alRueda, { passive: false });
    return () => el.removeEventListener("wheel", alRueda);
  }, []);

  const iniciar = (e: React.PointerEvent, campo: CampoOverlay, accion: Gesto["accion"]) => {
    e.stopPropagation();
    onSeleccionar(campo.id);
    if (soloLectura) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    gesto.current = { id: campo.id, accion, x0: e.clientX, y0: e.clientY, inicial: { x: campo.x, y: campo.y, w: campo.w, h: campo.h } };
  };

  const mover = (e: React.PointerEvent) => {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    const nueva =
      g.accion === "mover"
        ? arrastrarCampo(g.inicial, dx, dy, zoomRef.current, pagina)
        : redimensionarCampo(g.inicial, g.accion, dx, dy, zoomRef.current, pagina);
    onCambiarGeometria(g.id, { x: nueva.x, y: nueva.y, w: nueva.w, h: nueva.h });
  };

  const terminar = (e: React.PointerEvent) => {
    if (gesto.current) (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    gesto.current = null;
  };

  const alTeclear = (e: React.KeyboardEvent, campo: CampoOverlay) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Escape") return onSeleccionar(null);
    if (soloLectura) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      return onEliminar(campo.id);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const n = empujarCampo(campo, e.key, e.shiftKey, pagina);
      onCambiarGeometria(campo.id, { x: n.x, y: n.y, w: n.w, h: n.h });
    }
  };

  const ancho = mmAPx(pagina.ancho_mm, zoom);
  const alto = mmAPx(pagina.alto_mm, zoom);

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Zoom del lienzo">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setZoomManual(limitarZoom(zoom / 1.2))} aria-label="Alejar">
            <ZoomOut aria-hidden />
          </Button>
          <span className="w-14 text-center text-sm tabular-nums" aria-live="polite">{Math.round((zoom / PX_POR_MM_100) * 100)} %</span>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setZoomManual(limitarZoom(zoom * 1.2))} aria-label="Acercar">
            <ZoomIn aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setZoomManual(null)} disabled={zoomManual === null}>
            <Maximize2 aria-hidden /> Ajustar al ancho
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {pagina.ancho_mm.toFixed(0)} × {pagina.alto_mm.toFixed(0)} mm · Ctrl + rueda para el zoom
        </p>
      </div>

      <div ref={contenedor} className="max-h-[calc(100dvh-16rem)] min-h-[20rem] overflow-auto rounded-lg border bg-muted/50 p-3" data-testid="contenedor-lienzo">
        <div
          data-testid="lienzo"
          className="relative mx-auto bg-white shadow-md"
          style={{ width: ancho, height: alto }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onSeleccionar(null);
          }}
        >
          {imagenUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- PNG autenticado servido por el proxy GET; next/image no aplica
            <img src={imagenUrl} alt="Página del PDF de fondo" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none" />
          ) : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Sin imagen de fondo</div>
          )}
          {campos.map((c) => {
            const sel = c.id === seleccionadoId;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                data-campo-id={c.id}
                aria-label={`Campo ${c.tipo}: ${resumenCampo(c)}`}
                aria-pressed={sel}
                className={cn(
                  "absolute border outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  ESTILO_TIPO[c.tipo],
                  soloLectura ? "cursor-pointer" : "cursor-move",
                  sel && "z-10 border-2 border-primary ring-2 ring-primary/40",
                  conErrorIds.has(c.id) && "border-destructive bg-destructive/15",
                )}
                style={{ ...rectanguloEnPx(c, zoom), touchAction: sel ? "none" : "auto" }}
                onPointerDown={(e) => iniciar(e, c, "mover")}
                onPointerMove={mover}
                onPointerUp={terminar}
                onPointerCancel={terminar}
                onKeyDown={(e) => alTeclear(e, c)}
                onFocus={() => seleccionadoId !== c.id && onSeleccionar(c.id)}
              >
                <ContenidoCampo campo={c} zoom={zoom} />
                {sel && !soloLectura &&
                  ASAS.map((a) => (
                    <span
                      key={a.asa}
                      data-asa={a.asa}
                      className={cn("absolute size-4 rounded-sm border border-primary bg-background", a.clase, a.cursor)}
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => iniciar(e, c, a.asa)}
                      onPointerMove={mover}
                      onPointerUp={terminar}
                      onPointerCancel={terminar}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
