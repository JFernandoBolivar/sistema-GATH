/**
 * Tipos de datos para el Motor Diseñador Konva (O44 - E6, E7).
 * Todo el modelo de capas se expresa en milímetros (mm) y caras (anverso / reverso).
 * E7: Reglas de color dinámicas (criterio nómina, cargo, oficina, nivel, otro, único),
 * con respaldo y Funcionario azul marino (#1f3a5f) inicial.
 */

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
  // Formas personalizadas (SVG path normalizado 0..100)
  path?: string;
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

