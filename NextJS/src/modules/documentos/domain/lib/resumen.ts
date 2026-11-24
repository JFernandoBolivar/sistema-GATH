import type { Bloque, CampoOverlay } from "../entities/plantilla";

const recortar = (s: string, n = 60): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Resumen legible de un bloque para la lista ordenable. */
export function resumenBloque(b: Bloque): string {
  switch (b.tipo) {
    case "seccion":
      return b.titulo || "Sección sin título";
    case "fila_campos":
      return b.celdas.map((c) => c.etiqueta || (c.variable ? `{${c.variable}}` : "(en blanco)")).join(" · ");
    case "casillas":
      return `${b.etiqueta || "Casillas"}: ${b.opciones.map((o) => o.etiqueta).join(", ")}`;
    case "tabla":
      return `${b.titulo || b.coleccion || "Tabla"} (${b.columnas.length} columnas, mín. ${b.filas_minimas} filas)`;
    case "parrafo":
      return recortar(b.texto);
    case "foto":
      return `Foto ${b.ancho_mm}×${b.alto_mm} mm, ${b.alineacion}`;
    case "firmas":
      return b.firmantes.map((f) => f.etiqueta).join(" / ");
    case "salto_pagina":
      return "Continúa en una página nueva";
  }
}

export function resumenCampo(c: CampoOverlay): string {
  switch (c.tipo) {
    case "texto":
      return recortar(c.texto, 40);
    case "casilla":
      return c.condicion.variable ? `X si ${c.condicion.variable} ${c.condicion.operador} ${c.condicion.valor}`.trim() : "Casilla sin condición";
    case "foto":
      return "Foto";
    case "tabla":
      return `Tabla de ${c.coleccion || "?"}`;
  }
}
