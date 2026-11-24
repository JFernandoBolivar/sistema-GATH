/**
 * Errores del enlace de activación (D-10): códigos estables del backend (`data.codigo`) y su mensaje amable.
 * Los cuatro primeros agotan el enlace: la persona debe pedir uno nuevo a Captación.
 */

export type CodigoEnlace =
  | "ENLACE_INVALIDO"
  | "ENLACE_VENCIDO"
  | "ENLACE_USADO"
  | "ENLACE_BLOQUEADO"
  | "ACTIVACION_DATOS_INCORRECTOS"
  | "DEMASIADOS_INTENTOS"
  | "SERVICIO_NO_DISPONIBLE";

const CODIGOS_ENLACE: ReadonlySet<string> = new Set<CodigoEnlace>([
  "ENLACE_INVALIDO",
  "ENLACE_VENCIDO",
  "ENLACE_USADO",
  "ENLACE_BLOQUEADO",
  "ACTIVACION_DATOS_INCORRECTOS",
  "SERVICIO_NO_DISPONIBLE",
]);

/** Enlaces que ya no sirven para nada: la pantalla cambia a «Pide a Captación un enlace nuevo». */
const CODIGOS_TERMINALES: ReadonlySet<string> = new Set(["ENLACE_INVALIDO", "ENLACE_VENCIDO", "ENLACE_USADO", "ENLACE_BLOQUEADO"]);

export function esCodigoEnlace(valor: unknown): valor is CodigoEnlace {
  return typeof valor === "string" && CODIGOS_ENLACE.has(valor);
}

export function enlaceAgotado(codigo: string | undefined): boolean {
  return codigo !== undefined && CODIGOS_TERMINALES.has(codigo);
}

/** Código final a partir de lo que respondió el servidor (el 429 del límite de tasa no trae código propio). */
export function codigoDeEnlace(status: number, codigo: unknown): CodigoEnlace {
  if (esCodigoEnlace(codigo)) return codigo;
  if (status === 429) return "DEMASIADOS_INTENTOS";
  if (status === 404) return "ENLACE_INVALIDO";
  if (status === 410) return "ENLACE_VENCIDO";
  return "SERVICIO_NO_DISPONIBLE";
}

export interface MensajeEnlace {
  titulo: string;
  detalle: string;
}

export const PEDIR_ENLACE_NUEVO = "Pide a Captación un enlace nuevo.";

export function mensajeDeEnlace(codigo: CodigoEnlace): MensajeEnlace {
  switch (codigo) {
    case "ENLACE_INVALIDO":
      return { titulo: "Este enlace no es válido", detalle: "Puede que esté incompleto o que lo hayan reemplazado por uno más reciente." };
    case "ENLACE_VENCIDO":
      return { titulo: "Este enlace venció", detalle: "Los enlaces solo sirven por un tiempo limitado." };
    case "ENLACE_USADO":
      return { titulo: "Este enlace ya se usó", detalle: "Si ya creaste tu contraseña, ingresa con tu cédula y tu contraseña." };
    case "ENLACE_BLOQUEADO":
      return { titulo: "Este enlace se bloqueó", detalle: "Por seguridad, se bloquea tras varios intentos con una cédula que no coincide." };
    case "ACTIVACION_DATOS_INCORRECTOS":
      return { titulo: "No pudimos verificar tus datos", detalle: "Revisa tu cédula e inténtalo de nuevo." };
    case "DEMASIADOS_INTENTOS":
      return { titulo: "Demasiados intentos", detalle: "Espera un momento antes de volver a intentarlo." };
    case "SERVICIO_NO_DISPONIBLE":
      return { titulo: "No pudimos conectar con el sistema", detalle: "Inténtalo de nuevo en unos minutos." };
  }
}
