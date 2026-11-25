/**
 * M-4 (M7): la jerga interna «Ventana 1 / Ventana 2» no se muestra en pantalla.
 * Se usa «datos iniciales» y «datos complementarios». Sirve también para los
 * textos que llegan del backend (etiquetas de acciones, motivos, historial).
 */
export function sinJerga(texto: string): string {
  if (!texto) return texto;
  const r = texto
    .replace(/\b(de|a|en|con|para|por)\s+la\s+ventana\s*1\b/gi, "$1 los datos iniciales")
    .replace(/\b(de|a|en|con|para|por)\s+la\s+ventana\s*2\b/gi, "$1 los datos complementarios")
    .replace(/\bla\s+ventana\s*1\b/gi, "los datos iniciales")
    .replace(/\bla\s+ventana\s*2\b/gi, "los datos complementarios")
    .replace(/\bventana\s*1\b/gi, "datos iniciales")
    .replace(/\bventana\s*2\b/gi, "datos complementarios");
  return texto.charAt(0) === texto.charAt(0).toUpperCase() ? r.charAt(0).toUpperCase() + r.slice(1) : r;
}
