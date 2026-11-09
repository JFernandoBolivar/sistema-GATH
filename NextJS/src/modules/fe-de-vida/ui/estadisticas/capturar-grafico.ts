/**
 * Captura un gráfico Recharts (SVG) a PNG al doble de resolución, con fondo
 * blanco, para enviarlo al PDF y para el botón «Descargar».
 *
 * Inlinea los estilos calculados (colores de las CSS variables, tipografía y
 * opacidades) porque el SVG serializado se dibuja fuera del documento y no
 * resolvería las clases de Tailwind ni `var(--color-*)`.
 */
import { PALETA_GRAFICOS } from "./paleta-graficos";

const PROPIEDADES = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "color",
  "opacity",
  "fill-opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
] as const;

/** Escala del PNG de exportación: el ancho lógico es pequeño, así que se rasteriza más fino. */
export const ESCALA_EXPORTACION = 3;

/** Mismo límite que `MAX_LADO_GRAFICO` en `exportacion_estadisticas.py`. */
export const MAX_LADO_GRAFICO = 2400;

/**
 * Dimensiones finales del canvas, reduciendo la escala si el lado mayor supera
 * el límite del backend (pantallas anchas / devicePixelRatio).
 */
export function dimensionesCanvas(
  ancho: number,
  alto: number,
  escala: number,
  maxLado = MAX_LADO_GRAFICO,
): { ancho: number; alto: number } {
  const anchoBase = Math.max(1, Math.round(ancho * escala));
  const altoBase = Math.max(1, Math.round(alto * escala));
  const mayor = Math.max(anchoBase, altoBase);
  const factor = mayor > maxLado ? maxLado / mayor : 1;
  return {
    ancho: Math.min(maxLado, Math.max(1, Math.floor(anchoBase * factor))),
    alto: Math.min(maxLado, Math.max(1, Math.floor(altoBase * factor))),
  };
}

/** Entrada de la leyenda que se dibuja dentro del PNG (la de Recharts es HTML y no se captura). */
export interface EntradaLeyenda {
  nombre: string;
  color: string;
}

export interface OpcionesCaptura {
  /** Leyenda a dibujar debajo del gráfico, dentro de la imagen. */
  leyenda?: readonly EntradaLeyenda[];
}

const TAMANO_LEYENDA = 13;
const LADO_MUESTRA = 12;
const SEPARACION_MUESTRA = 6;
const SEPARACION_ENTRADAS = 22;
const ALTO_LEYENDA = 26;
const PROPORCION_ANCHO_CARACTER = 0.52;
const ESPACIO_SVG = "http://www.w3.org/2000/svg";

function anchoEntrada(entrada: EntradaLeyenda): number {
  return LADO_MUESTRA + SEPARACION_MUESTRA + entrada.nombre.length * TAMANO_LEYENDA * PROPORCION_ANCHO_CARACTER;
}

/** Reparte las entradas en filas que quepan en `ancho` (una entrada nunca se parte). */
function filasDeLeyenda(leyenda: readonly EntradaLeyenda[], ancho: number): EntradaLeyenda[][] {
  const filas: EntradaLeyenda[][] = [];
  let actual: EntradaLeyenda[] = [];
  let usado = 0;
  for (const entrada of leyenda) {
    const necesario = anchoEntrada(entrada) + (actual.length > 0 ? SEPARACION_ENTRADAS : 0);
    if (actual.length > 0 && usado + necesario > ancho) {
      filas.push(actual);
      actual = [];
      usado = 0;
    }
    usado += anchoEntrada(entrada) + (actual.length > 0 ? SEPARACION_ENTRADAS : 0);
    actual.push(entrada);
  }
  if (actual.length > 0) filas.push(actual);
  return filas;
}

/**
 * Agrega la leyenda centrada bajo el gráfico dentro del SVG clonado (en varias
 * filas si no cabe) y devuelve el alto adicional que ocupa (0 si no hay entradas).
 */
export function agregarLeyendaSvg(
  svg: SVGSVGElement,
  leyenda: readonly EntradaLeyenda[],
  ancho: number,
  altoGrafico: number,
): number {
  if (leyenda.length === 0) return 0;
  const filas = filasDeLeyenda(leyenda, ancho);
  const grupo = document.createElementNS(ESPACIO_SVG, "g");
  grupo.setAttribute("data-leyenda", "true");
  filas.forEach((fila, indice) => {
    const total =
      fila.reduce((suma, entrada) => suma + anchoEntrada(entrada), 0) +
      SEPARACION_ENTRADAS * (fila.length - 1);
    let x = Math.max(0, (ancho - total) / 2);
    const yCentro = altoGrafico + ALTO_LEYENDA * indice + ALTO_LEYENDA / 2;
    for (const entrada of fila) {
      const muestra = document.createElementNS(ESPACIO_SVG, "rect");
      muestra.setAttribute("x", String(x));
      muestra.setAttribute("y", String(yCentro - LADO_MUESTRA / 2));
      muestra.setAttribute("width", String(LADO_MUESTRA));
      muestra.setAttribute("height", String(LADO_MUESTRA));
      muestra.setAttribute("rx", "2");
      muestra.setAttribute("fill", entrada.color);
      const texto = document.createElementNS(ESPACIO_SVG, "text");
      texto.setAttribute("x", String(x + LADO_MUESTRA + SEPARACION_MUESTRA));
      texto.setAttribute("y", String(yCentro));
      texto.setAttribute("dominant-baseline", "central");
      texto.setAttribute("font-size", String(TAMANO_LEYENDA));
      texto.setAttribute("font-family", "system-ui, -apple-system, 'Segoe UI', sans-serif");
      texto.setAttribute("fill", PALETA_GRAFICOS.grisTexto);
      texto.textContent = entrada.nombre;
      grupo.append(muestra, texto);
      x += anchoEntrada(entrada) + SEPARACION_ENTRADAS;
    }
  });
  svg.appendChild(grupo);
  return ALTO_LEYENDA * filas.length;
}

/**
 * Espera a que Recharts haya medido y dibujado el gráfico (copias fuera de
 * pantalla para el PDF). Devuelve el contenedor o lanza si no aparece a tiempo.
 */
export async function esperarGraficoListo(
  obtener: () => HTMLElement | null,
  tiempoMaximoMs = 5000,
): Promise<HTMLElement> {
  const inicio = Date.now();
  while (Date.now() - inicio < tiempoMaximoMs) {
    const contenedor = obtener();
    const svg = contenedor?.querySelector("svg");
    if (contenedor && svg && svg.getBoundingClientRect().width > 0 && svg.querySelector("text")) {
      await new Promise((resolver) => setTimeout(resolver, 150));
      return contenedor;
    }
    await new Promise((resolver) => setTimeout(resolver, 50));
  }
  throw new Error("El gráfico para el reporte no terminó de dibujarse.");
}

export async function capturarGraficoPng(
  contenedor: HTMLElement,
  escala = 2,
  opciones: OpcionesCaptura = {},
): Promise<string> {
  const svg = contenedor.querySelector("svg");
  if (!svg) throw new Error("No se encontró el gráfico para capturar.");
  const clon = svg.cloneNode(true) as SVGSVGElement;
  const originales = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const clones = [clon, ...Array.from(clon.querySelectorAll("*"))];
  originales.forEach((original, indice) => {
    const destino = clones[indice];
    if (!destino) return;
    const estilos = window.getComputedStyle(original);
    for (const propiedad of PROPIEDADES) {
      const valor = estilos.getPropertyValue(propiedad);
      if (valor) destino.setAttribute(propiedad, valor);
    }
    destino.removeAttribute("class");
  });

  const caja = svg.getBoundingClientRect();
  const ancho = Math.max(320, Math.round(caja.width || 640));
  const altoGrafico = Math.max(180, Math.round(caja.height || 320));
  const extra = agregarLeyendaSvg(clon, opciones.leyenda ?? [], ancho, altoGrafico);
  const alto = altoGrafico + extra;
  clon.setAttribute("xmlns", ESPACIO_SVG);
  clon.setAttribute("width", String(ancho));
  clon.setAttribute("height", String(alto));
  clon.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);

  const xml = new XMLSerializer().serializeToString(clon);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const imagen = await cargarImagen(url);
    const canvas = document.createElement("canvas");
    const dimensiones = dimensionesCanvas(ancho, alto, escala);
    canvas.width = dimensiones.ancho;
    canvas.height = dimensiones.alto;
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("El navegador no pudo preparar la imagen.");
    contexto.fillStyle = PALETA_GRAFICOS.blanco;
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    imagen.onload = () => resolver(imagen);
    imagen.onerror = () => rechazar(new Error("No se pudo preparar la imagen del gráfico."));
    imagen.src = url;
  });
}

/** Descarga un PNG ya capturado (data URL). */
export function descargarPng(dataUrl: string, nombre: string): void {
  const enlace = document.createElement("a");
  enlace.href = dataUrl;
  enlace.download = `${nombre}.png`;
  enlace.click();
}
