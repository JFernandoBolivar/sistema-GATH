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

export async function capturarGraficoPng(contenedor: HTMLElement, escala = 2): Promise<string> {
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
  const alto = Math.max(180, Math.round(caja.height || 320));
  clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clon.setAttribute("width", String(ancho));
  clon.setAttribute("height", String(alto));
  if (!clon.getAttribute("viewBox")) clon.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);

  const xml = new XMLSerializer().serializeToString(clon);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const imagen = await cargarImagen(url);
    const canvas = document.createElement("canvas");
    canvas.width = ancho * escala;
    canvas.height = alto * escala;
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
