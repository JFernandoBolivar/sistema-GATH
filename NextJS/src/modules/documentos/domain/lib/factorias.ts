import type {
  Bloque,
  CampoOverlay,
  CampoPropio,
  CatalogoVariables,
  DefinicionFormulario,
  DefinicionOverlay,
  ModoPlantilla,
  TipoBloque,
  TipoCampoOverlay,
} from "../entities/plantilla";
import { generarId } from "./ids";
import { coleccionesDisponibles } from "./variables";

type Catalogo = Pick<CatalogoVariables, "variables"> | null | undefined;

export const ETIQUETAS_BLOQUE: Record<TipoBloque, string> = {
  seccion: "Sección",
  fila_campos: "Fila de campos",
  casillas: "Casillas",
  tabla: "Tabla",
  parrafo: "Párrafo",
  foto: "Foto",
  firmas: "Firmas",
  salto_pagina: "Salto de página",
};

export const ETIQUETAS_CAMPO_OVERLAY: Record<TipoCampoOverlay, string> = {
  texto: "Texto",
  casilla: "Casilla «X»",
  foto: "Foto",
  tabla: "Tabla",
};

/** Bloque nuevo con valores por defecto; en la tabla toma la primera colección del catálogo. */
export function nuevoBloque(tipo: TipoBloque, existentes: Bloque[], catalogo?: Catalogo): Bloque {
  const id = generarId("b", existentes.map((b) => b.id));
  switch (tipo) {
    case "seccion":
      return { id, tipo, titulo: "Nueva sección" };
    case "fila_campos":
      return { id, tipo, celdas: [{ etiqueta: "Campo", variable: null, ancho: 12 }], alto_mm: 12 };
    case "casillas":
      return {
        id,
        tipo,
        etiqueta: "Opciones",
        variable: "",
        columnas: 4,
        opciones: [
          { valor: "SI", etiqueta: "Sí" },
          { valor: "NO", etiqueta: "No" },
        ],
      };
    case "tabla": {
      const col = coleccionesDisponibles(catalogo)[0];
      return {
        id,
        tipo,
        titulo: col?.etiqueta ?? "Tabla",
        coleccion: col?.clave ?? "",
        columnas: (col?.columnas ?? []).slice(0, 3).map((c) => ({ variable: c.clave, etiqueta: c.etiqueta, ancho: 4 })),
        filas_minimas: 3,
      };
    }
    case "parrafo":
      return { id, tipo, texto: "Escriba el texto. Puede usar variables como {nombres}.", alineacion: "justificado" };
    case "foto":
      return { id, tipo, alineacion: "derecha", ancho_mm: 30, alto_mm: 40 };
    case "firmas":
      return { id, tipo, firmantes: [{ etiqueta: "Firma del trabajador", detalle: "" }] };
    case "salto_pagina":
      return { id, tipo };
  }
}

/** Campo nuevo sobre el PDF, en la posición dada (mm). */
export function nuevoCampoOverlay(
  tipo: TipoCampoOverlay,
  existentes: CampoOverlay[],
  posicion: { x: number; y: number } = { x: 20, y: 20 },
  catalogo?: Catalogo,
): CampoOverlay {
  const id = generarId("c", existentes.map((c) => c.id));
  const { x, y } = posicion;
  switch (tipo) {
    case "texto":
      return { id, tipo, x, y, w: 60, h: 6, texto: "{nombres}", tamano: 9, alineacion: "izquierda", negrita: false };
    case "casilla":
      return { id, tipo, x, y, w: 4, h: 4, condicion: { variable: "", operador: "igual", valor: "" } };
    case "foto":
      return { id, tipo, x, y, w: 30, h: 40 };
    case "tabla": {
      const col = coleccionesDisponibles(catalogo)[0];
      const cols = (col?.columnas ?? []).slice(0, 3);
      return {
        id,
        tipo,
        x,
        y,
        w: 150,
        h: 40,
        coleccion: col?.clave ?? "",
        columnas: cols.map((c, i) => ({ variable: c.clave, dx: i * 50, ancho: 50, alineacion: "izquierda" as const })),
        interlineado: 6,
        filas_max: 5,
        tamano: 8,
      };
    }
  }
}

export function nuevoCampoPropio(existentes: CampoPropio[]): CampoPropio {
  let n = existentes.length + 1;
  const claves = new Set(existentes.map((c) => c.clave));
  while (claves.has(`campo_${n}`)) n += 1;
  return { clave: `campo_${n}`, etiqueta: `Campo ${n}`, tipo: "texto", obligatorio: false, ayuda: "" };
}

export function definicionVacia(modo: ModoPlantilla): DefinicionFormulario | DefinicionOverlay {
  if (modo === "formulario") {
    return {
      pagina: { tamano: "carta", orientacion: "vertical" },
      encabezado: { tipo: "institucional", titulo: "Título del documento", subtitulo: "" },
      bloques: [],
    };
  }
  return { paginas: [] };
}

/** Clave de campo propio válida a partir de una etiqueta libre (`^[a-z][a-z0-9_]{0,39}$`). */
export function claveDesdeEtiqueta(etiqueta: string): string {
  const base = etiqueta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const clave = /^[a-z]/.test(base) ? base : `c_${base}`;
  return clave.slice(0, 40).replace(/_+$/g, "") || "campo";
}
