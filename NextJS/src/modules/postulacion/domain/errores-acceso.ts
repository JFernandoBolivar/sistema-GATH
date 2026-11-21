/**
 * Errores de acceso del postulante (D-5/D-6): códigos estables del backend
 * (`data.codigo`) y su traducción a un mensaje claro para la pantalla.
 *
 * Genérico a propósito en las credenciales: nunca se dice si la cédula existe
 * (§13.3.4 de la propuesta técnica).
 */

export type CodigoAcceso =
  | "CREDENCIALES_INVALIDAS"
  | "CREDENCIAL_BLOQUEADA"
  | "CREDENCIAL_VENCIDA"
  | "ACCESO_NO_DISPONIBLE"
  | "SESION_INVALIDA"
  | "CAMBIO_CLAVE_OBLIGATORIO"
  | "SERVICIO_NO_DISPONIBLE";

const CODIGOS: ReadonlySet<string> = new Set<CodigoAcceso>([
  "CREDENCIALES_INVALIDAS",
  "CREDENCIAL_BLOQUEADA",
  "CREDENCIAL_VENCIDA",
  "ACCESO_NO_DISPONIBLE",
  "SESION_INVALIDA",
  "CAMBIO_CLAVE_OBLIGATORIO",
  "SERVICIO_NO_DISPONIBLE",
]);

export function esCodigoAcceso(valor: unknown): valor is CodigoAcceso {
  return typeof valor === "string" && CODIGOS.has(valor);
}

/** Código que NextAuth entrega al cliente (`CredentialsSignin.code`). */
const SEPARADOR_BLOQUEO = "|";

/**
 * Convierte la respuesta de error de `acceso/` en el código de NextAuth. La hora de
 * desbloqueo viaja en el mismo texto (`CREDENCIAL_BLOQUEADA|2026-11-21T14:30:00+00:00`).
 */
export function codigoNextAuthDeAcceso(
  status: number,
  codigo: unknown,
  bloqueadaHasta?: unknown,
): string {
  if (esCodigoAcceso(codigo)) {
    if (codigo === "CREDENCIAL_BLOQUEADA" && typeof bloqueadaHasta === "string" && bloqueadaHasta) {
      return `${codigo}${SEPARADOR_BLOQUEO}${bloqueadaHasta}`;
    }
    return codigo;
  }
  if (status === 429) return "CREDENCIAL_BLOQUEADA";
  if (status === 401) return "CREDENCIALES_INVALIDAS";
  return "SERVICIO_NO_DISPONIBLE";
}

export interface FalloAcceso {
  codigo: CodigoAcceso;
  /** ISO 8601; solo con `CREDENCIAL_BLOQUEADA`. */
  bloqueadaHasta?: string;
}

/** Inversa de `codigoNextAuthDeAcceso`: lo que llega en `result.code` de `signIn`. */
export function falloDeCodigoNextAuth(codigo: string | null | undefined): FalloAcceso {
  const texto = codigo ?? "";
  const [base, ...resto] = texto.split(SEPARADOR_BLOQUEO);
  if (esCodigoAcceso(base)) {
    const hasta = resto.join(SEPARADOR_BLOQUEO);
    return base === "CREDENCIAL_BLOQUEADA" && hasta
      ? { codigo: base, bloqueadaHasta: hasta }
      : { codigo: base };
  }
  // `CredentialsSignin` sin código propio: se trata como credenciales inválidas.
  return { codigo: "CREDENCIALES_INVALIDAS" };
}

/** Hora local de Venezuela (HH:MM) de una marca ISO; `null` si no se puede interpretar. */
export function horaDeDesbloqueo(iso: string | undefined): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Caracas",
  }).format(fecha);
}

export function mensajeDeAcceso(fallo: FalloAcceso): string {
  switch (fallo.codigo) {
    case "CREDENCIALES_INVALIDAS":
      return "La cédula o la contraseña no son correctas. Revísalas e inténtalo de nuevo.";
    case "CREDENCIAL_BLOQUEADA": {
      const hora = horaDeDesbloqueo(fallo.bloqueadaHasta);
      return hora
        ? `Por seguridad, tu acceso está bloqueado hasta las ${hora}. Podrás intentarlo de nuevo a esa hora.`
        : "Por seguridad, tu acceso está bloqueado por unos minutos tras varios intentos fallidos. Inténtalo de nuevo más tarde.";
    }
    case "CREDENCIAL_VENCIDA":
      return "Tu clave de acceso venció. Comunícate con Captación para que te habiliten un acceso nuevo.";
    case "ACCESO_NO_DISPONIBLE":
      return "En este momento no tienes nada pendiente por completar. Captación te contactará si hace falta.";
    case "SESION_INVALIDA":
      return "Tu sesión terminó. Ingresa de nuevo con tu cédula y tu contraseña.";
    case "CAMBIO_CLAVE_OBLIGATORIO":
      return "Antes de continuar debes cambiar tu contraseña temporal.";
    case "SERVICIO_NO_DISPONIBLE":
      return "No pudimos conectar con el sistema. Inténtalo de nuevo en unos minutos.";
  }
}

export interface ErrorApiPostulacion {
  status: number;
  codigo?: string;
  bloqueadaHasta?: string;
  /** Mensaje que mandó el servidor (ya en español). */
  mensajeServidor: string;
  /** El servidor marcó errores por campo (`data.errores`). */
  conErroresDeCampo: boolean;
}

export interface ErrorPresentable {
  mensaje: string;
  /** La sesión del postulante ya no sirve: hay que volver a la pantalla de acceso. */
  sesionCaida: boolean;
}

/**
 * Traduce un error de las rutas autenticadas (`mi-expediente`, `borrador`, `enviar`, `cambiar-clave`).
 * Los errores con campo (p. ej. «la contraseña actual no es correcta») conservan el texto del servidor.
 */
export function presentarErrorApi(e: ErrorApiPostulacion): ErrorPresentable {
  const sesionCaida =
    e.codigo === "SESION_INVALIDA" ||
    (e.status === 401 && e.codigo !== "CREDENCIALES_INVALIDAS" && !e.conErroresDeCampo);
  if (sesionCaida) return { mensaje: mensajeDeAcceso({ codigo: "SESION_INVALIDA" }), sesionCaida: true };
  if (e.conErroresDeCampo) return { mensaje: e.mensajeServidor, sesionCaida: false };
  if (esCodigoAcceso(e.codigo)) {
    return {
      mensaje: mensajeDeAcceso({ codigo: e.codigo, bloqueadaHasta: e.bloqueadaHasta }),
      sesionCaida: false,
    };
  }
  if (e.status === 0) return { mensaje: mensajeDeAcceso({ codigo: "SERVICIO_NO_DISPONIBLE" }), sesionCaida: false };
  return { mensaje: e.mensajeServidor || "No fue posible completar la operación.", sesionCaida: false };
}
