import type { CampoOverlay, GeometriaCampo } from "../entities/plantilla";

/** Paso de ajuste de las coordenadas del lienzo (mm). */
export const PASO_MM = 0.5;
export const PASO_MM_GRANDE = 5;
export const LADO_MINIMO_MM = 1;

export interface DimensionPagina {
  ancho_mm: number;
  alto_mm: number;
}

/** `zoom` = px por mm. */
export const mmAPx = (mm: number, zoom: number): number => mm * zoom;
export const pxAMm = (px: number, zoom: number): number => (zoom > 0 ? px / zoom : 0);

export function ajustarAPaso(mm: number, paso = PASO_MM): number {
  return Math.round(mm / paso) * paso;
}

const redondear = (n: number): number => Math.round(n * 100) / 100;

/** Zoom (px/mm) para que la página ocupe `anchoDisponiblePx`. */
export function zoomParaAncho(anchoDisponiblePx: number, anchoPaginaMm: number): number {
  if (anchoPaginaMm <= 0 || anchoDisponiblePx <= 0) return 1;
  return anchoDisponiblePx / anchoPaginaMm;
}

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 8;
export const limitarZoom = (z: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

/**
 * Mantiene el campo dentro de la página: tamaño al menos 1 mm y no mayor que la página,
 * y la esquina (x, y) tal que el campo entre completo.
 */
export function limitarCampoALaPagina<T extends GeometriaCampo>(campo: T, pagina: DimensionPagina): T {
  const w = Math.min(Math.max(campo.w, LADO_MINIMO_MM), pagina.ancho_mm);
  const h = Math.min(Math.max(campo.h, LADO_MINIMO_MM), pagina.alto_mm);
  const x = Math.min(Math.max(campo.x, 0), pagina.ancho_mm - w);
  const y = Math.min(Math.max(campo.y, 0), pagina.alto_mm - h);
  return { ...campo, x: redondear(x), y: redondear(y), w: redondear(w), h: redondear(h) };
}

/** Arrastre: desplazamiento del puntero en px → nueva posición en mm, ajustada y dentro de la página. */
export function arrastrarCampo<T extends GeometriaCampo>(
  inicial: T,
  dxPx: number,
  dyPx: number,
  zoom: number,
  pagina: DimensionPagina,
): T {
  return limitarCampoALaPagina(
    {
      ...inicial,
      x: ajustarAPaso(inicial.x + pxAMm(dxPx, zoom)),
      y: ajustarAPaso(inicial.y + pxAMm(dyPx, zoom)),
    },
    pagina,
  );
}

/** Asa de redimensionado: esquina inferior derecha (`se`), borde derecho (`e`) o inferior (`s`), etc. */
export type AsaRedimension = "n" | "s" | "e" | "o" | "ne" | "no" | "se" | "so";

export function redimensionarCampo<T extends GeometriaCampo>(
  inicial: T,
  asa: AsaRedimension,
  dxPx: number,
  dyPx: number,
  zoom: number,
  pagina: DimensionPagina,
): T {
  const dx = ajustarAPaso(pxAMm(dxPx, zoom));
  const dy = ajustarAPaso(pxAMm(dyPx, zoom));
  let { x, y, w, h } = inicial;
  if (asa.includes("e")) w = inicial.w + dx;
  if (asa.includes("o")) {
    w = inicial.w - dx;
    x = inicial.x + dx;
  }
  if (asa.includes("s")) h = inicial.h + dy;
  if (asa.includes("n")) {
    h = inicial.h - dy;
    y = inicial.y + dy;
  }
  // Tamaño mínimo: la esquina fija no se mueve al llegar al tope.
  if (w < LADO_MINIMO_MM) {
    if (asa.includes("o")) x = inicial.x + inicial.w - LADO_MINIMO_MM;
    w = LADO_MINIMO_MM;
  }
  if (h < LADO_MINIMO_MM) {
    if (asa.includes("n")) y = inicial.y + inicial.h - LADO_MINIMO_MM;
    h = LADO_MINIMO_MM;
  }
  // Recorte contra los bordes de la página sin desplazar el lado opuesto.
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (x + w > pagina.ancho_mm) w = pagina.ancho_mm - x;
  if (y + h > pagina.alto_mm) h = pagina.alto_mm - y;
  return limitarCampoALaPagina({ ...inicial, x, y, w, h }, pagina);
}

/** Flechas del teclado: 0,5 mm (Shift = 5 mm). */
export function empujarCampo<T extends GeometriaCampo>(
  campo: T,
  tecla: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown",
  grande: boolean,
  pagina: DimensionPagina,
): T {
  const paso = grande ? PASO_MM_GRANDE : PASO_MM;
  const dx = tecla === "ArrowLeft" ? -paso : tecla === "ArrowRight" ? paso : 0;
  const dy = tecla === "ArrowUp" ? -paso : tecla === "ArrowDown" ? paso : 0;
  return limitarCampoALaPagina({ ...campo, x: campo.x + dx, y: campo.y + dy }, pagina);
}

/** Estilo en px (según el zoom) del rectángulo de un campo. */
export function rectanguloEnPx(campo: GeometriaCampo, zoom: number) {
  return {
    left: mmAPx(campo.x, zoom),
    top: mmAPx(campo.y, zoom),
    width: mmAPx(campo.w, zoom),
    height: mmAPx(campo.h, zoom),
  };
}

export type { CampoOverlay };
