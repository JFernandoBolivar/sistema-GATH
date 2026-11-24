import type {
  Bloque,
  CampoOverlay,
  DefinicionOverlay,
} from "../entities/plantilla";
import { generarId } from "./ids";

/** Mueve el bloque `desdeId` a la posición `haciaIndice` (0..n-1 en la lista resultante). */
export function reordenarBloques(lista: Bloque[], desdeId: string, haciaIndice: number): Bloque[] {
  const desde = lista.findIndex((b) => b.id === desdeId);
  if (desde < 0) return lista;
  const destino = Math.max(0, Math.min(haciaIndice, lista.length - 1));
  if (destino === desde) return lista;
  const copia = [...lista];
  const [bloque] = copia.splice(desde, 1);
  copia.splice(destino, 0, bloque);
  return copia;
}

/** Sube (-1) o baja (+1) un bloque; en los extremos no hace nada. */
export function moverBloque(lista: Bloque[], id: string, delta: -1 | 1): Bloque[] {
  const i = lista.findIndex((b) => b.id === id);
  if (i < 0) return lista;
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  return reordenarBloques(lista, id, j);
}

/** Copia profunda del bloque con id nuevo, justo después del original. */
export function duplicarBloque(lista: Bloque[], id: string): { lista: Bloque[]; nuevoId: string | null } {
  const i = lista.findIndex((b) => b.id === id);
  if (i < 0) return { lista, nuevoId: null };
  const nuevoId = generarId("b", lista.map((b) => b.id));
  const copia = { ...structuredClone(lista[i]), id: nuevoId } as Bloque;
  return { lista: [...lista.slice(0, i + 1), copia, ...lista.slice(i + 1)], nuevoId };
}

export function eliminarBloque(lista: Bloque[], id: string): Bloque[] {
  return lista.filter((b) => b.id !== id);
}

/** Inserta tras el bloque `despuesDeId` (o al final si no se indica o no existe). */
export function insertarBloque(lista: Bloque[], bloque: Bloque, despuesDeId?: string | null): Bloque[] {
  const i = despuesDeId ? lista.findIndex((b) => b.id === despuesDeId) : -1;
  if (i < 0) return [...lista, bloque];
  return [...lista.slice(0, i + 1), bloque, ...lista.slice(i + 1)];
}

/** Actualiza (inmutable) las propiedades de un bloque; el `id` y el `tipo` no se pueden cambiar. */
export function actualizarBloque(lista: Bloque[], id: string, cambios: Partial<Bloque>): Bloque[] {
  return lista.map((b) => {
    if (b.id !== id) return b;
    const { id: _id, tipo: _tipo, ...resto } = cambios as Record<string, unknown>;
    return { ...b, ...resto } as Bloque;
  });
}

// ───────────────────────── Modo overlay ─────────────────────────

export function actualizarCampo(
  campos: CampoOverlay[],
  id: string,
  cambios: Partial<CampoOverlay>,
): CampoOverlay[] {
  return campos.map((c) => {
    if (c.id !== id) return c;
    const { id: _id, tipo: _tipo, ...resto } = cambios as Record<string, unknown>;
    return { ...c, ...resto } as CampoOverlay;
  });
}

/** Todos los ids de campo de la definición (son únicos en TODAS las páginas). */
export function idsDeCampos(def: DefinicionOverlay): string[] {
  return def.paginas.flatMap((p) => p.campos.map((c) => c.id));
}

export function duplicarCampo(
  def: DefinicionOverlay,
  paginaIdx: number,
  id: string,
  desplazamientoMm = 3,
): { definicion: DefinicionOverlay; nuevoId: string | null } {
  const pagina = def.paginas[paginaIdx];
  const original = pagina?.campos.find((c) => c.id === id);
  if (!pagina || !original) return { definicion: def, nuevoId: null };
  const nuevoId = generarId("c", idsDeCampos(def));
  const copia = { ...structuredClone(original), id: nuevoId, x: original.x + desplazamientoMm, y: original.y + desplazamientoMm };
  return {
    definicion: {
      ...def,
      paginas: def.paginas.map((p, i) => (i === paginaIdx ? { ...p, campos: [...p.campos, copia] } : p)),
    },
    nuevoId,
  };
}

export function eliminarCampo(def: DefinicionOverlay, paginaIdx: number, id: string): DefinicionOverlay {
  return {
    ...def,
    paginas: def.paginas.map((p, i) => (i === paginaIdx ? { ...p, campos: p.campos.filter((c) => c.id !== id) } : p)),
  };
}

export function agregarCampo(def: DefinicionOverlay, paginaIdx: number, campo: CampoOverlay): DefinicionOverlay {
  return {
    ...def,
    paginas: def.paginas.map((p, i) => (i === paginaIdx ? { ...p, campos: [...p.campos, campo] } : p)),
  };
}

export function actualizarCampoEnPagina(
  def: DefinicionOverlay,
  paginaIdx: number,
  id: string,
  cambios: Partial<CampoOverlay>,
): DefinicionOverlay {
  return {
    ...def,
    paginas: def.paginas.map((p, i) => (i === paginaIdx ? { ...p, campos: actualizarCampo(p.campos, id, cambios) } : p)),
  };
}

/** Agrega una página del PDF (por su número de origen) al final de la definición. */
export function agregarPaginaOrigen(def: DefinicionOverlay, origen: number): DefinicionOverlay {
  return { ...def, paginas: [...def.paginas, { origen, campos: [] }] };
}

export function quitarPagina(def: DefinicionOverlay, paginaIdx: number): DefinicionOverlay {
  return { ...def, paginas: def.paginas.filter((_, i) => i !== paginaIdx) };
}

/** Mueve la página de la definición (con sus campos) a otra posición. */
export function moverPagina(def: DefinicionOverlay, paginaIdx: number, delta: -1 | 1): DefinicionOverlay {
  const j = paginaIdx + delta;
  if (paginaIdx < 0 || paginaIdx >= def.paginas.length || j < 0 || j >= def.paginas.length) return def;
  const paginas = [...def.paginas];
  [paginas[paginaIdx], paginas[j]] = [paginas[j], paginas[paginaIdx]];
  return { ...def, paginas };
}

/** Duplica una página (mismo origen, copia de sus campos con ids nuevos) justo después. */
export function duplicarPagina(def: DefinicionOverlay, paginaIdx: number): DefinicionOverlay {
  const p = def.paginas[paginaIdx];
  if (!p) return def;
  const usados = idsDeCampos(def);
  const campos = p.campos.map((c) => {
    const id = generarId("c", usados);
    usados.push(id);
    return { ...structuredClone(c), id } as CampoOverlay;
  });
  const paginas = [...def.paginas];
  paginas.splice(paginaIdx + 1, 0, { origen: p.origen, campos });
  return { ...def, paginas };
}
