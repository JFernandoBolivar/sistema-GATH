/**
 * Tipos de datos para el Motor Diseñador Konva (O44 - E6, E7).
 * Todo el modelo de capas se expresa en milímetros (mm) y caras (anverso / reverso).
 * E7: Reglas de color dinámicas (criterio nómina, cargo, oficina, nivel, otro, único),
 * con respaldo y Funcionario azul marino (#1f3a5f) inicial.
 */

import type { PuntoForma } from "./forma-puntos";
import type { QrEstilo } from "./qr-estilo";

export type TipoElementoKonva =
  | "field"
  | "text"
  | "rect"
  | "circle"
  | "tri"
  | "diag"
  | "path"
  | "photo"
  | "qr"
  | "image";

export interface ElementoKonva {
  id: string;
  t: TipoElementoKonva;
  name: string;
  cara: "anverso" | "reverso";
  x: number; // en mm
  y: number; // en mm
  w: number; // en mm
  h: number; // en mm
  r: number; // rotación en grados
  fill: string; // color propio o referencia de regla ("rule:primario", "rule:acento", "rule:texto")
  stroke: string; // color del borde
  sw: number; // grosor del borde
  rad: number; // radio de esquinas redondeadas
  shadow: number; // nivel de sombra
  op: number; // opacidad (0 a 100)
  // Propiedades de Texto / Campo
  text?: string;
  field?: string;
  font?: string;
  size?: number; // tamaño de letra en pt
  bold?: boolean;
  ital?: boolean;
  align?: "left" | "center" | "right";
  // Propiedades de Imagen / Biblioteca
  src?: string;
  biblioteca_id?: string;
  // Etiqueta de marcador para imágenes sin asset (FIRMA, LOGO)
  etiqueta?: string;
  // diag: variante 'diagr' (acento diagonal opuesto) del PDF
  diagr?: boolean;
  // Estilo del QR (props.qr_estilo); ausente = institucional
  qr_estilo?: QrEstilo;
  // Formas personalizadas (SVG path normalizado 0..100)
  path?: string;
  // Forma editable por puntos (props.puntos): vértices en la caja 0..100 con radio en mm.
  // Si existe, el path se genera desde aquí; `path` queda como copia para quien no la entienda.
  puntos?: PuntoForma[];
  // Rectángulo: radio por esquina en mm [sup-izq, sup-der, inf-der, inf-izq] (props.radios)
  radios?: [number, number, number, number];
  // Organización
  grupo_id?: string | null;
  bloqueado?: boolean;
  oculto?: boolean;
}

export type CriterioColor = "unico" | "nomina" | "cargo" | "oficina" | "nivel" | "otro";

export interface ReglaColorValores {
  primario: string;
  acento: string;
  texto: string;
}

export interface ReglasColorConfig {
  criterio: CriterioColor;
  respaldo: ReglaColorValores;
  valores: Record<string, ReglaColorValores>;
  /**
   * Solo del editor (no se guarda): valores de cada criterio que se dejó al cambiar de
   * criterio, para recuperarlos si se vuelve a él. El motor usa únicamente `valores`.
   */
  valoresPorCriterio?: Partial<Record<CriterioColor, Record<string, ReglaColorValores>>>;
}

/**
 * Criterios que el PDF (resolver_color.py + datos de carnet_pdf.py) sabe aplicar: nómina, cargo
 * y oficina salen del titular. `nivel` y `otro` no existen en los datos del PDF y caen al
 * color de respaldo, por eso no se ofrecen.
 */
export const CRITERIOS_COLOR_SOPORTADOS: readonly CriterioColor[] = [
  "unico",
  "nomina",
  "cargo",
  "oficina",
];

export const ETIQUETA_VALORES_CRITERIO: Record<CriterioColor, string> = {
  unico: "Valor único",
  nomina: "Tipos de nómina",
  cargo: "Cargos",
  oficina: "Oficinas / dependencias",
  nivel: "Niveles",
  otro: "Valores",
};

/** Tipo de credencial externa (visitante, contratista...) tal como lo entrega el catálogo. */
export interface TipoExternoColor {
  codigo: string;
  nombre: string;
}

/** Listas reales de cargo y oficina que entrega el backend para el diseñador. */
export interface SugerenciasReglasColor {
  cargos: string[];
  oficinas: string[];
}

/**
 * Valores sugeridos de un criterio. La nómina suma los tipos de credencial externa: el PDF
 * usa su código en mayúsculas como nómina, así que la regla se llama igual (VISITANTE).
 * Cargo y oficina usan las listas reales del backend (el mismo texto del PDF).
 */
export function sugerenciasCriterio(
  criterio: CriterioColor,
  tiposExternos: readonly TipoExternoColor[] = [],
  sugerencias: Partial<SugerenciasReglasColor> = {},
): string[] {
  if (criterio === "cargo") return [...new Set(sugerencias.cargos ?? [])];
  if (criterio === "oficina") return [...new Set(sugerencias.oficinas ?? [])];
  if (criterio !== "nomina") return [];
  const externos = tiposExternos.map((t) => t.codigo.toUpperCase());
  return [...new Set([...Object.keys(REGLAS_COLOR_DEFECTO.valores), ...externos])];
}

/**
 * Añade de una vez todos los valores sugeridos que aún no tienen regla, con el
 * color de respaldo vigente, para poder usar «Aplicar a todos/seleccionados».
 */
export function cargarValoresSugeridos(
  reglas: ReglasColorConfig,
  valores: readonly string[],
): ReglasColorConfig {
  const nuevos = { ...reglas.valores };
  for (const valor of valores) {
    const clave = valor.trim();
    if (clave && !(clave in nuevos)) {
      nuevos[clave] = { ...reglas.respaldo };
    }
  }
  return { ...reglas, valores: nuevos };
}

/** Etiqueta legible de un valor sugerido (ej. VISITANTE -> «Visitante»), o null si no la hay. */
export function etiquetaSugerencia(
  valor: string,
  tiposExternos: readonly TipoExternoColor[] = [],
): string | null {
  return tiposExternos.find((t) => t.codigo.toUpperCase() === valor)?.nombre ?? null;
}

/**
 * Pone la combinación primario/acento a todos los valores del criterio (`claves` omitido)
 * o solo a los indicados. Conserva el color de texto de cada valor.
 */
export function aplicarColoresAValores(
  reglas: ReglasColorConfig,
  colores: { primario: string; acento: string },
  claves?: readonly string[],
): ReglasColorConfig {
  const objetivo = claves ? new Set(claves) : null;
  const valores: Record<string, ReglaColorValores> = {};
  for (const [clave, val] of Object.entries(reglas.valores)) {
    valores[clave] =
      !objetivo || objetivo.has(clave)
        ? { ...val, primario: colores.primario, acento: colores.acento }
        : val;
  }
  return { ...reglas, valores };
}

/** Deja los valores sin regla: todos usarán el color de respaldo. */
export function quitarTodosLosValores(reglas: ReglasColorConfig): ReglasColorConfig {
  return { ...reglas, valores: {} };
}

/**
 * Cambia el criterio de color: guarda los valores del criterio actual y carga los del nuevo
 * (los de nómina arrancan con los institucionales; el resto, vacíos).
 */
export function cambiarCriterioColor(
  reglas: ReglasColorConfig,
  nuevo: CriterioColor,
): ReglasColorConfig {
  if (nuevo === reglas.criterio) return reglas;
  const guardados = { ...(reglas.valoresPorCriterio ?? {}), [reglas.criterio]: reglas.valores };
  const valores =
    guardados[nuevo] ?? (nuevo === "nomina" ? { ...REGLAS_COLOR_DEFECTO.valores } : {});
  return { ...reglas, criterio: nuevo, valores, valoresPorCriterio: guardados };
}

export const REGLAS_COLOR_DEFECTO: ReglasColorConfig = {
  criterio: "nomina",
  respaldo: {
    primario: "#1f3a5f", // Azul marino institucional Funcionario
    acento: "#1273bd",
    texto: "#ffffff",
  },
  valores: {
    "Funcionario": { primario: "#1f3a5f", acento: "#1273bd", texto: "#ffffff" },
    "Alto Nivel": { primario: "#1f3a5f", acento: "#1273bd", texto: "#ffffff" },
    "Empleado Fijo": { primario: "#16264a", acento: "#1273bd", texto: "#ffffff" },
    "Contratado": { primario: "#c79a12", acento: "#16264a", texto: "#ffffff" },
    "Obrero Fijo": { primario: "#b3121b", acento: "#16264a", texto: "#ffffff" },
    "Obrero Contratado": { primario: "#b3121b", acento: "#16264a", texto: "#ffffff" },
    "Honorarios Profesionales": { primario: "#2a6f6a", acento: "#16264a", texto: "#ffffff" },
    "Comisión de Servicio": { primario: "#4b5f8a", acento: "#16264a", texto: "#ffffff" },
    "Pasante": { primario: "#6b7686", acento: "#16264a", texto: "#ffffff" },
    "Jubilado": { primario: "#1f4e38", acento: "#2d7a58", texto: "#ffffff" },
    "Pensionado": { primario: "#1f4e38", acento: "#2d7a58", texto: "#ffffff" },
  },
};

export function normalizarClaveColor(cadena: string): string {
  return cadena
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

export function resolverColorDeRegla(
  config: ReglasColorConfig | undefined,
  persona: PersonaMuestra
): ReglaColorValores {
  const respaldo = config?.respaldo ?? REGLAS_COLOR_DEFECTO.respaldo;
  if (!config || config.criterio === "unico") {
    return respaldo;
  }

  let valorPersona: string | undefined;
  if (config.criterio === "nomina") {
    valorPersona = persona.nomina;
  } else if (config.criterio === "cargo") {
    valorPersona = persona.cargo;
  } else if (config.criterio === "oficina") {
    valorPersona = persona.oficina;
  } else if (config.criterio === "nivel") {
    valorPersona = persona.nivel;
  } else if (config.criterio === "otro") {
    valorPersona = persona.nomina;
  }

  if (!valorPersona) return respaldo;

  const claveNorm = normalizarClaveColor(valorPersona);
  for (const [key, val] of Object.entries(config.valores || {})) {
    if (normalizarClaveColor(key) === claveNorm) {
      return val;
    }
  }

  return respaldo;
}

export interface DefinicionPlantillaKonva {
  ancho_mm: number;
  alto_mm: number;
  orientacion: "vertical" | "horizontal";
  elementos: ElementoKonva[];
  reglas_color?: ReglasColorConfig;
}

export interface PersonaMuestra {
  nombre: string;
  cedula: string;
  nac: string;
  correo: string;
  cargo: string;
  codigo: string;
  oficina: string;
  nivel: string;
  nomina: string;
  ingreso: string;
  sangre: string;
  alerg: string;
  emer: string;
  emision: string;
  vence: string;
  foto_url?: string;
}

export const PERSONA_FICTICIA_DEFECTO: PersonaMuestra = {
  nombre: "Ana Sofía Pérez Luna",
  cedula: "V-16.778.340",
  nac: "12/04/1985",
  correo: "aperez@institucion.gob.ve",
  cargo: "Especialista en Telecomunicaciones",
  codigo: "A-0845",
  oficina: "Oficina de Gestión Humana",
  nivel: "Nivel de Apoyo",
  nomina: "Funcionario",
  ingreso: "15/03/2018",
  sangre: "O Rh+",
  alerg: "Alergia a Penicilina",
  emer: "Luis Pérez (0414-555-0142)",
  emision: "07/11/2026",
  vence: "07/11/2028",
};

export type PosicionAlineacion =
  | "left"
  | "center-h"
  | "right"
  | "top"
  | "center-v"
  | "bottom";

export function duplicarElementoKonva(
  elemento: ElementoKonva,
  anchoMm: number,
  altoMm: number,
  nuevoId: string
): ElementoKonva {
  return {
    ...elemento,
    id: nuevoId,
    name: `${elemento.name} (Copia)`,
    x: Math.min(anchoMm - 10, elemento.x + 3),
    y: Math.min(altoMm - 10, elemento.y + 3),
  };
}

export function alinearElementoKonva(
  elemento: ElementoKonva,
  pos: PosicionAlineacion,
  anchoMm: number,
  altoMm: number
): { x: number; y: number } {
  let nuevoX = elemento.x;
  let nuevoY = elemento.y;

  if (pos === "left") nuevoX = 0;
  if (pos === "center-h") nuevoX = (anchoMm - elemento.w) / 2;
  if (pos === "right") nuevoX = anchoMm - elemento.w;
  if (pos === "top") nuevoY = 0;
  if (pos === "center-v") nuevoY = (altoMm - elemento.h) / 2;
  if (pos === "bottom") nuevoY = altoMm - elemento.h;

  return {
    x: Number(nuevoX.toFixed(2)),
    y: Number(nuevoY.toFixed(2)),
  };
}

export function moverCapaKonva(
  elementos: ElementoKonva[],
  id: string,
  direccion: "arriba" | "abajo"
): ElementoKonva[] {
  const index = elementos.findIndex((e) => e.id === id);
  if (index === -1) return elementos;

  if (direccion === "arriba" && index < elementos.length - 1) {
    const nueva = [...elementos];
    const temp = nueva[index];
    nueva[index] = nueva[index + 1];
    nueva[index + 1] = temp;
    return nueva;
  }
  if (direccion === "abajo" && index > 0) {
    const nueva = [...elementos];
    const temp = nueva[index];
    nueva[index] = nueva[index - 1];
    nueva[index - 1] = temp;
    return nueva;
  }
  return elementos;
}


/** Shift/Ctrl+clic: agrega el id a la selección o lo quita si ya estaba. */
export function alternarSeleccionKonva(seleccion: readonly string[], id: string): string[] {
  return seleccion.includes(id) ? seleccion.filter((s) => s !== id) : [...seleccion, id];
}

/** Ctrl+A: ids de todos los elementos visibles y de la cara indicada. */
export function idsDeCaraKonva(
  elementos: readonly ElementoKonva[],
  cara: "anverso" | "reverso",
): string[] {
  return elementos.filter((e) => e.cara === cara && !e.oculto).map((e) => e.id);
}

/** Quita varios elementos de una sola vez (una sola entrada de historial). */
export function eliminarElementosKonva(
  elementos: readonly ElementoKonva[],
  ids: readonly string[],
): ElementoKonva[] {
  const quitar = new Set(ids);
  return elementos.filter((e) => !quitar.has(e.id));
}

/** Alinea varios elementos respecto al recuadro que los contiene. */
export function alinearVariosKonva(
  elementos: readonly ElementoKonva[],
  ids: readonly string[],
  pos: "left" | "center-h" | "right",
): ElementoKonva[] {
  const sel = elementos.filter((e) => ids.includes(e.id));
  if (sel.length < 2) return [...elementos];
  const minX = Math.min(...sel.map((e) => e.x));
  const maxX = Math.max(...sel.map((e) => e.x + e.w));
  return elementos.map((e) => {
    if (!ids.includes(e.id)) return e;
    const x =
      pos === "left" ? minX : pos === "right" ? maxX - e.w : (minX + maxX) / 2 - e.w / 2;
    return { ...e, x: Number(x.toFixed(2)) };
  });
}

export type AlcanceLimpieza ="cara-actual" | "ambas";

/**
 * Quita los elementos de la cara indicada (o de ambas). No toca dimensiones,
 * orientación ni tipo: solo devuelve la lista de elementos restante.
 */
export function limpiarElementosKonva(
  elementos: readonly ElementoKonva[],
  alcance: AlcanceLimpieza,
  cara: "anverso" | "reverso",
): ElementoKonva[] {
  if (alcance === "ambas") return [];
  return elementos.filter((e) => e.cara !== cara);
}

/** Tamaño mínimo (mm) de QR legible con teléfono (SILOG); el backend manda con su parámetro. */
export const QR_MINIMO_MM_DEFECTO = 20;

/**
 * Lado útil (el menor de ancho y alto, en mm) del QR más grande de la plantilla,
 * contando ambas caras; 0 si no hay ningún QR.
 */
export function ladoQrMasGrandeMm(elementos: readonly ElementoKonva[]): number {
  return elementos.reduce(
    (mayor, e) => (e.t === "qr" ? Math.max(mayor, Math.min(e.w, e.h)) : mayor),
    0,
  );
}

/** True si ningún QR de la plantilla alcanza el mínimo legible. */
export function qrInsuficiente(
  elementos: readonly ElementoKonva[],
  minimoMm: number = QR_MINIMO_MM_DEFECTO,
): boolean {
  return ladoQrMasGrandeMm(elementos) < minimoMm;
}
