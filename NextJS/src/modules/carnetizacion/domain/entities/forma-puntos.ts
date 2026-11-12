/**
 * Formas editables por puntos del diseñador de carnets.
 *
 * Una forma es una lista de vértices en una caja de 0 a 100 (`x`, `y`) con un radio de
 * redondeo propio en milímetros (`r`). De ahí se genera el path SVG (solo M, L, Q y Z, que el
 * PDF ya dibuja): cada esquina redondeada es una curva Q cuyo control es el vértice.
 */

export interface PuntoForma {
  x: number;
  y: number;
  /** Radio de redondeo de este vértice, en mm (0 = esquina viva). */
  r: number;
}

export const MINIMO_PUNTOS = 3;

const redondear = (v: number) => Number(v.toFixed(2));
const acotar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Longitud en mm de la arista entre dos vértices de la caja 0..100 de un elemento w × h mm. */
function longitudMm(a: PuntoForma, b: PuntoForma, w: number, h: number): number {
  return Math.hypot(((b.x - a.x) * w) / 100, ((b.y - a.y) * h) / 100);
}

/** Mayor radio que admite el vértice `i`: la mitad de la más corta de sus dos aristas. */
export function radioMaximoMm(puntos: readonly PuntoForma[], i: number, w: number, h: number): number {
  const n = puntos.length;
  if (n < MINIMO_PUNTOS) return 0;
  const lp = longitudMm(puntos[(i - 1 + n) % n], puntos[i], w, h);
  const ln = longitudMm(puntos[i], puntos[(i + 1) % n], w, h);
  return redondear(Math.min(lp, ln) / 2);
}

/**
 * Path SVG (caja 0..100) de la lista de vértices. El radio se mide en mm sobre el elemento
 * de `w` × `h` mm, así que se recalcula si el elemento cambia de tamaño.
 */
export function generarPathDesdePuntos(puntos: readonly PuntoForma[], w: number, h: number): string {
  const n = puntos.length;
  if (n < MINIMO_PUNTOS || !(w > 0) || !(h > 0)) return "";
  const mm = puntos.map((p) => ({ x: (p.x * w) / 100, y: (p.y * h) / 100 }));
  const caja = (x: number, y: number) => `${redondear((x * 100) / w)} ${redondear((y * 100) / h)}`;

  const tramos = mm.map((p, i) => {
    const r = puntos[i].r;
    if (!(r > 0)) return null;
    const prev = mm[(i - 1 + n) % n];
    const next = mm[(i + 1) % n];
    const lp = Math.hypot(prev.x - p.x, prev.y - p.y);
    const ln = Math.hypot(next.x - p.x, next.y - p.y);
    if (lp === 0 || ln === 0) return null;
    const d = Math.min(r, lp / 2, ln / 2);
    return {
      ini: { x: p.x + ((prev.x - p.x) / lp) * d, y: p.y + ((prev.y - p.y) / lp) * d },
      fin: { x: p.x + ((next.x - p.x) / ln) * d, y: p.y + ((next.y - p.y) / ln) * d },
    };
  });

  const partes = mm.map((p, i) => {
    const t = tramos[i];
    const orden = i === 0 ? "M" : "L";
    if (!t) return `${orden} ${caja(p.x, p.y)}`;
    return `${orden} ${caja(t.ini.x, t.ini.y)} Q ${caja(p.x, p.y)} ${caja(t.fin.x, t.fin.y)}`;
  });
  return `${partes.join(" ")} Z`;
}

/** Mueve un vértice dentro de la caja 0..100. */
export function moverPunto(puntos: readonly PuntoForma[], i: number, x: number, y: number): PuntoForma[] {
  return puntos.map((p, k) => (k === i ? { ...p, x: redondear(acotar(x, 0, 100)), y: redondear(acotar(y, 0, 100)) } : p));
}

/** Cambia el radio de un vértice (>= 0). */
export function cambiarRadioPunto(puntos: readonly PuntoForma[], i: number, r: number): PuntoForma[] {
  return puntos.map((p, k) => (k === i ? { ...p, r: redondear(Math.max(0, r)) } : p));
}

/**
 * Agrega un vértice sobre la arista más cercana al punto (x, y) de la caja 0..100.
 * Devuelve la nueva lista y el índice del vértice agregado.
 */
export function agregarPuntoCercano(
  puntos: readonly PuntoForma[],
  x: number,
  y: number,
  w = 100,
  h = 100,
): { puntos: PuntoForma[]; indice: number } {
  const n = puntos.length;
  let mejor = { arista: 0, d: Infinity, px: 0, py: 0 };
  for (let i = 0; i < n; i++) {
    const a = puntos[i];
    const b = puntos[(i + 1) % n];
    const ax = (a.x * w) / 100, ay = (a.y * h) / 100;
    const bx = (b.x * w) / 100, by = (b.y * h) / 100;
    const cx = (x * w) / 100, cy = (y * h) / 100;
    const dx = bx - ax, dy = by - ay;
    const largo2 = dx * dx + dy * dy;
    const t = largo2 === 0 ? 0 : acotar(((cx - ax) * dx + (cy - ay) * dy) / largo2, 0, 1);
    const qx = ax + t * dx, qy = ay + t * dy;
    const d = Math.hypot(cx - qx, cy - qy);
    if (d < mejor.d) mejor = { arista: i, d, px: (qx * 100) / w, py: (qy * 100) / h };
  }
  const nuevo: PuntoForma = { x: redondear(mejor.px), y: redondear(mejor.py), r: 0 };
  const copia = [...puntos];
  copia.splice(mejor.arista + 1, 0, nuevo);
  return { puntos: copia, indice: mejor.arista + 1 };
}

/** Quita un vértice; con solo 3 no hace nada (una forma cerrada necesita al menos 3). */
export function eliminarPunto(puntos: readonly PuntoForma[], i: number): PuntoForma[] {
  if (puntos.length <= MINIMO_PUNTOS || i < 0 || i >= puntos.length) return [...puntos];
  return puntos.filter((_, k) => k !== i);
}

/** Lee una lista de puntos guardada (props.puntos); null si no es válida. */
export function normalizarPuntos(valor: unknown): PuntoForma[] | null {
  if (!Array.isArray(valor) || valor.length < MINIMO_PUNTOS) return null;
  const lista: PuntoForma[] = [];
  for (const p of valor) {
    if (!p || typeof p !== "object") return null;
    const { x, y, r } = p as Record<string, unknown>;
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
    const nr = Number(r ?? 0);
    lista.push({ x: acotar(nx, 0, 100), y: acotar(ny, 0, 100), r: Number.isFinite(nr) ? Math.max(0, nr) : 0 });
  }
  return lista;
}

/** Puntos de un triángulo y de una franja diagonal, iguales a como los dibuja el PDF. */
export const PUNTOS_TRIANGULO: readonly PuntoForma[] = [
  { x: 50, y: 0, r: 0 },
  { x: 100, y: 100, r: 0 },
  { x: 0, y: 100, r: 0 },
];
export const PUNTOS_FRANJA_DIAGONAL: readonly PuntoForma[] = [
  { x: 0, y: 0, r: 0 },
  { x: 100, y: 0, r: 0 },
  { x: 72, y: 100, r: 0 },
  { x: 0, y: 100, r: 0 },
];

/**
 * Convierte un path con M, L, H, V, C, Q y Z absolutos en vértices (las curvas pierden su
 * curvatura: se queda el punto final; el radio sirve para volver a curvar). Null si usa
 * comandos relativos o no se entiende.
 */
export function puntosDesdePath(path: string): PuntoForma[] | null {
  const validacion = validarPathSvg(path);
  if (!validacion.valido) return null;
  const tokens = path.match(/[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? [];
  const puntos: PuntoForma[] = [];
  let cmd = "";
  let x = 0;
  let y = 0;
  const aridad: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4 };
  let i = 0;
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i++];
      if (cmd !== cmd.toUpperCase()) return null;
      continue;
    }
    if (cmd === "Z" || !aridad[cmd]) return null;
    const n = aridad[cmd];
    const a = tokens.slice(i, i + n).map(Number);
    i += n;
    if (cmd === "H") x = a[0];
    else if (cmd === "V") y = a[0];
    else {
      x = a[n - 2];
      y = a[n - 1];
    }
    puntos.push({ x: acotar(x, 0, 100), y: acotar(y, 0, 100), r: 0 });
    if (cmd === "M") cmd = "L";
  }
  const ultimo = puntos[puntos.length - 1];
  const primero = puntos[0];
  if (ultimo && primero && puntos.length > MINIMO_PUNTOS && ultimo.x === primero.x && ultimo.y === primero.y) {
    puntos.pop();
  }
  return puntos.length >= MINIMO_PUNTOS ? puntos : null;
}

export type ValidacionPath = { valido: true } | { valido: false; mensaje: string };

const ARIDAD: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, Z: 0 };

/**
 * Valida un path SVG tal como lo entiende el PDF: solo M, L, H, V, C, Q y Z (mayúscula o
 * minúscula) con números, y la cantidad de números que pide cada instrucción.
 */
export function validarPathSvg(texto: string): ValidacionPath {
  const limpio = texto.trim();
  if (!limpio) return { valido: false, mensaje: "Escribe al menos una instrucción (por ejemplo M 0 0)." };
  const patron = /([A-Za-z])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)|[\s,]+|(.)/gy;
  let cmd = "";
  let cantidad = 0;
  let primera = true;

  const cerrarInstruccion = (): string | null => {
    if (!cmd) return null;
    const a = ARIDAD[cmd.toUpperCase()];
    if (a === 0) return cantidad === 0 ? null : `"Z" no lleva números`;
    if (cantidad === 0 || cantidad % a !== 0) return `Faltan números en "${cmd}"`;
    return null;
  };

  let m: RegExpExecArray | null;
  while ((m = patron.exec(limpio)) !== null) {
    if (m[1]) {
      const error = cerrarInstruccion();
      if (error) return { valido: false, mensaje: error };
      if (!(m[1].toUpperCase() in ARIDAD)) {
        return { valido: false, mensaje: `Instrucción no válida: "${m[1]}"` };
      }
      if (primera && m[1].toUpperCase() !== "M") {
        return { valido: false, mensaje: 'La forma debe empezar con "M"' };
      }
      primera = false;
      cmd = m[1];
      cantidad = 0;
    } else if (m[2] !== undefined) {
      if (!cmd) return { valido: false, mensaje: 'La forma debe empezar con "M"' };
      cantidad += 1;
    } else if (m[3]) {
      return { valido: false, mensaje: `Carácter no válido: "${m[3]}"` };
    }
    if (patron.lastIndex >= limpio.length) break;
  }
  const error = cerrarInstruccion();
  if (error) return { valido: false, mensaje: error };
  return { valido: true };
}

/** Radios de las 4 esquinas de un rectángulo, en mm, en el orden [sup-izq, sup-der, inf-der, inf-izq]. */
export function radiosEsquinasMm(el: {
  w: number;
  h: number;
  rad: number;
  radios?: readonly number[];
}): [number, number, number, number] {
  const tope = Math.max(0, Math.min(el.w, el.h) / 2);
  const base =
    el.radios && el.radios.length === 4 && el.radios.every((r) => Number.isFinite(r))
      ? el.radios
      : [el.rad || 0, el.rad || 0, el.rad || 0, el.rad || 0];
  const [a, b, c, d] = base.map((r) => acotar(r, 0, tope));
  return [a, b, c, d];
}

/** Valor de `cornerRadius` de Konva (px): número si son iguales, arreglo si no. */
export function cornerRadiusParaRect(
  el: { w: number; h: number; rad: number; radios?: readonly number[] },
  escala: number,
): number | number[] {
  const mm = radiosEsquinasMm(el);
  const px = mm.map((r) => r * escala);
  return px.every((r) => r === px[0]) ? px[0] : px;
}
