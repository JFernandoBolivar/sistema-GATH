import type {
  CampoPropio,
  CatalogoVariables,
  ColumnaColeccion,
  TipoVariable,
  VariableCatalogo,
} from "../entities/plantilla";

export const PREFIJO_PROPIO = "propio.";
export const GRUPO_PROPIOS = "Campos propios del documento";

const REGEX_VARIABLE = /\{([a-z][a-z0-9_.]*)\}/g;

export const TIPOS_ESCALARES: readonly TipoVariable[] = ["texto", "fecha", "si_no"];

/** Nombres de variable (`nombre` o `propio.clave`) presentes en un texto con `{...}`, sin repetir. */
export function extraerVariables(texto: string | null | undefined): string[] {
  const salida: string[] = [];
  for (const m of (texto ?? "").matchAll(REGEX_VARIABLE)) {
    if (!salida.includes(m[1])) salida.push(m[1]);
  }
  return salida;
}

function tipoDeCampoPropio(campo: CampoPropio): TipoVariable {
  if (campo.tipo === "fecha") return "fecha";
  if (campo.tipo === "si_no") return "si_no";
  return "texto";
}

/** Variables del campo propio, con la forma del catálogo, bajo el grupo «Campos propios del documento». */
export function variablesDeCamposPropios(propios: CampoPropio[]): VariableCatalogo[] {
  return propios
    .filter((c) => c.clave)
    .map((c) => ({
      clave: PREFIJO_PROPIO + c.clave,
      etiqueta: c.etiqueta || c.clave,
      descripcion: c.ayuda || "Campo propio del documento",
      grupo: GRUPO_PROPIOS,
      tipo: tipoDeCampoPropio(c),
      ejemplo: "",
    }));
}

interface OpcionesVariables {
  /** Solo escalares (`texto|fecha|si_no`): las que caben en una celda, un texto o una condición. */
  soloEscalares?: boolean;
  /** Solo colecciones (para las tablas). */
  soloColecciones?: boolean;
}

/** Catálogo del backend + campos propios del borrador. */
export function variablesDisponibles(
  catalogo: CatalogoVariables | { variables: VariableCatalogo[] } | null | undefined,
  propios: CampoPropio[],
  opciones: OpcionesVariables = {},
): VariableCatalogo[] {
  const base = catalogo?.variables ?? [];
  let todas = [...base, ...variablesDeCamposPropios(propios)];
  if (opciones.soloEscalares) todas = todas.filter((v) => TIPOS_ESCALARES.includes(v.tipo));
  if (opciones.soloColecciones) todas = todas.filter((v) => v.tipo === "coleccion");
  return todas;
}

export interface GrupoVariables {
  grupo: string;
  variables: VariableCatalogo[];
}

/** Agrupa por `grupo` conservando el orden de aparición. */
export function agruparVariables(variables: VariableCatalogo[]): GrupoVariables[] {
  const grupos: GrupoVariables[] = [];
  for (const v of variables) {
    let g = grupos.find((x) => x.grupo === v.grupo);
    if (!g) {
      g = { grupo: v.grupo, variables: [] };
      grupos.push(g);
    }
    g.variables.push(v);
  }
  return grupos;
}

function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Filtro del buscador del selector: etiqueta, clave, descripción o grupo, sin acentos. */
export function filtrarVariables(variables: VariableCatalogo[], consulta: string): VariableCatalogo[] {
  const q = sinAcentos(consulta.trim());
  if (!q) return variables;
  return variables.filter((v) =>
    sinAcentos(`${v.etiqueta} ${v.clave} ${v.descripcion} ${v.grupo}`).includes(q),
  );
}

export function coleccionesDisponibles(catalogo: { variables: VariableCatalogo[] } | null | undefined): VariableCatalogo[] {
  return (catalogo?.variables ?? []).filter((v) => v.tipo === "coleccion");
}

export function columnasDeColeccion(
  catalogo: { variables: VariableCatalogo[] } | null | undefined,
  coleccion: string,
): ColumnaColeccion[] {
  return coleccionesDisponibles(catalogo).find((c) => c.clave === coleccion)?.columnas ?? [];
}

/** Conjuntos de claves válidas para validar: escalares (incluye `propio.*`) y columnas por colección. */
export interface ContextoVariables {
  escalares: Set<string>;
  colecciones: Map<string, Set<string>>;
}

export function contextoDeVariables(
  catalogo: { variables: VariableCatalogo[] } | null | undefined,
  propios: CampoPropio[],
): ContextoVariables {
  const escalares = new Set<string>();
  const colecciones = new Map<string, Set<string>>();
  for (const v of catalogo?.variables ?? []) {
    if (TIPOS_ESCALARES.includes(v.tipo)) escalares.add(v.clave);
    if (v.tipo === "coleccion") colecciones.set(v.clave, new Set((v.columnas ?? []).map((c) => c.clave)));
  }
  for (const p of propios) if (p.clave) escalares.add(PREFIJO_PROPIO + p.clave);
  return { escalares, colecciones };
}

/** Variables de un texto que no son escalares conocidas ni campos propios declarados. */
export function variablesDesconocidas(texto: string | null | undefined, ctx: ContextoVariables): string[] {
  return extraerVariables(texto).filter((v) => !ctx.escalares.has(v));
}

/** Inserta `{clave}` en el texto, reemplazando la selección `[inicio, fin)`. Devuelve el texto y la posición del cursor. */
export function insertarVariableEnTexto(
  texto: string,
  clave: string,
  inicio?: number | null,
  fin?: number | null,
): { texto: string; cursor: number } {
  const marca = `{${clave}}`;
  const a = Math.max(0, Math.min(inicio ?? texto.length, texto.length));
  const b = Math.max(a, Math.min(fin ?? a, texto.length));
  return { texto: texto.slice(0, a) + marca + texto.slice(b), cursor: a + marca.length };
}

// ───────────────────── Ayuda para las casillas ─────────────────────

const VALORES_COMUNES: Record<string, string[]> = {
  nacionalidad: ["VENEZOLANO", "EXTRANJERO"],
  sexo: ["MASCULINO", "FEMENINO"],
  estado_civil: ["SOLTERO", "CASADO", "DIVORCIADO", "VIUDO", "UNIDO"],
  tipo_vivienda: ["CASA", "QUINTA", "APARTAMENTO", "HOTEL/PENSION", "HABITACION", "VIVIENDA RUSTICA", "OTRA"],
  tipo_empleado: ["FIJO", "CONTRATADO", "OBRERO", "JUBILADO"],
};

function capitalizar(valor: string): string {
  const t = valor.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Opciones sugeridas para una casilla según la variable: valores comunes conocidos,
 * «SI/NO» para las de tipo `si_no` y las opciones declaradas de un campo propio.
 */
export function opcionesSugeridas(
  variable: string,
  catalogo: { variables: VariableCatalogo[] } | null | undefined,
  propios: CampoPropio[],
): { valor: string; etiqueta: string }[] {
  let valores: string[] = [];
  if (variable.startsWith(PREFIJO_PROPIO)) {
    const p = propios.find((c) => PREFIJO_PROPIO + c.clave === variable);
    if (p?.tipo === "si_no") valores = ["SI", "NO"];
    else if (p?.tipo === "opcion") valores = p.opciones ?? [];
  } else if (VALORES_COMUNES[variable]) {
    valores = VALORES_COMUNES[variable];
  } else if (catalogo?.variables.find((v) => v.clave === variable)?.tipo === "si_no") {
    valores = ["SI", "NO"];
  }
  return valores.slice(0, 12).map((v) => ({ valor: v, etiqueta: v === "SI" ? "Sí" : v === "NO" ? "No" : capitalizar(v) }));
}
