import type { ElementoKonva } from "./disenador";
import { generarPathDesdePuntos, type PuntoForma } from "./forma-puntos";

/**
 * Formas institucionales del carnet (calcadas de la propuesta oficial, tarjeta de 54 x 85,6 mm
 * en vertical). Cada una es un elemento «Forma SVG» (`t: "path"`): el trazo vive en una caja de
 * 0 a 100 que el editor y el PDF escalan al ancho y alto del elemento. Se definen como vértices
 * con radio de redondeo (`puntos`), así se pueden retocar con «Editar puntos»; el path que se
 * genera de ahí usa solo M, L y Q (más Z), que el PDF ya dibuja.
 */

/** Colores de respaldo de la plantilla («Primario» y «Acento»). */
export const COLOR_PRIMARIO_INSTITUCIONAL = "#14284b";
export const COLOR_ACENTO_INSTITUCIONAL = "#c8102e";
export const COLOR_BANDA_TENUE = "#f2f3f5";

/** Alto de la tarjeta en mm (el ancho es 54). */
export const ANCHO_CARNET_MM = 54;
export const ALTO_CARNET_MM = 85.6;

export type FormaInstitucionalId =
  | "encabezado-diagonal"
  | "franja-esquina"
  | "pie-diagonal-izquierdo"
  | "pie-diagonal-derecho"
  | "banda-tenue"
  | "encabezado-v";

export interface FormaInstitucional {
  id: FormaInstitucionalId;
  nombre: string;
  /** Cara de la propuesta oficial en la que aparece. */
  cara: "anverso" | "reverso";
  /** Color con el que se dibuja la miniatura (el de respaldo del fill). */
  colorMiniatura: string;
  elemento: Omit<ElementoKonva, "id" | "cara">;
}

function forma(
  id: FormaInstitucionalId,
  nombre: string,
  cara: "anverso" | "reverso",
  fill: string,
  colorMiniatura: string,
  geo: { x: number; y: number; w: number; h: number },
  puntos: PuntoForma[],
): FormaInstitucional {
  return {
    id,
    nombre,
    cara,
    colorMiniatura,
    elemento: {
      t: "path",
      name: nombre,
      ...geo,
      r: 0,
      fill,
      stroke: "",
      sw: 0,
      rad: 0,
      shadow: 0,
      op: 100,
      puntos,
      path: generarPathDesdePuntos(puntos, geo.w, geo.h),
    },
  };
}

export const FORMAS_INSTITUCIONALES: readonly FormaInstitucional[] = [
  forma(
    "encabezado-diagonal",
    "Encabezado diagonal",
    "anverso",
    "rule:primario",
    COLOR_PRIMARIO_INSTITUCIONAL,
    { x: 0, y: 0, w: 54, h: 12.8 },
    [{ x: 0, y: 0, r: 0 }, { x: 85.4, y: 0, r: 0 }, { x: 63.9, y: 100, r: 3.4 }, { x: 0, y: 100, r: 0 }],
  ),
  forma(
    "franja-esquina",
    "Franja de esquina",
    "anverso",
    "rule:acento",
    COLOR_ACENTO_INSTITUCIONAL,
    { x: 39.8, y: 0, w: 14.2, h: 6.6 },
    [{ x: 44.4, y: 0, r: 0 }, { x: 100, y: 0, r: 0 }, { x: 61.6, y: 100, r: 1.3 }, { x: 0, y: 100, r: 0 }],
  ),
  forma(
    "pie-diagonal-izquierdo",
    "Pie diagonal izquierdo",
    "anverso",
    "rule:primario",
    COLOR_PRIMARIO_INSTITUCIONAL,
    { x: 0, y: 73.6, w: 34.5, h: 12 },
    [{ x: 0, y: 0, r: 0 }, { x: 100, y: 0, r: 0 }, { x: 65.6, y: 100, r: 0 }, { x: 0, y: 100, r: 0 }],
  ),
  forma(
    "pie-diagonal-derecho",
    "Pie diagonal derecho",
    "anverso",
    "rule:acento",
    COLOR_ACENTO_INSTITUCIONAL,
    { x: 27, y: 73.6, w: 27, h: 12 },
    [{ x: 0, y: 100, r: 0 }, { x: 49.1, y: 0, r: 2.4 }, { x: 100, y: 0, r: 0 }, { x: 100, y: 100, r: 0 }],
  ),
  forma(
    "banda-tenue",
    "Banda tenue",
    "anverso",
    COLOR_BANDA_TENUE,
    COLOR_BANDA_TENUE,
    { x: 10.4, y: 29.6, w: 43.6, h: 44 },
    [{ x: 100, y: 0, r: 0 }, { x: 100, y: 100, r: 0 }, { x: 0, y: 100, r: 0 }],
  ),
  forma(
    "encabezado-v",
    "Encabezado en V",
    "reverso",
    "rule:primario",
    COLOR_PRIMARIO_INSTITUCIONAL,
    { x: 0, y: 0, w: 54, h: 6.8 },
    [{ x: 0, y: 0, r: 0 }, { x: 100, y: 0, r: 0 }, { x: 100, y: 31, r: 0 }, { x: 91.1, y: 100, r: 2 }, { x: 12.2, y: 100, r: 2 }, { x: 0, y: 31, r: 0 }],
  ),
];

/** Elemento listo para `onAnadirElemento`, sobre la cara que se está editando. */
export function crearElementoDeForma(
  forma: FormaInstitucional,
  cara: "anverso" | "reverso",
): Omit<ElementoKonva, "id"> {
  return { ...forma.elemento, cara };
}
