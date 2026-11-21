/**
 * Reglas de ruta del postulante (D-6) para `proxy.ts`, sin dependencias de Next para poder probarlas.
 *
 * - `/postulacion/*` solo para el rol sintético POSTULANTE; `acceso` y `recibido` son públicas.
 * - Un empleado logueado no entra a `/postulacion/*` (va a su inicio).
 * - Con `debeCambiarClave`, todo el área redirige a `/postulacion/cambiar-clave`.
 * - Un POSTULANTE no pisa ninguna ruta del sistema de personal: vuelve a `/postulacion`.
 *
 * El proxy es UX; la autoridad es el `scope` del token que valida Django en cada llamada.
 */

export const ROL_POSTULANTE = "POSTULANTE";

export const RUTA_POSTULACION = "/postulacion";
export const RUTA_ACCESO_POSTULANTE = "/postulacion/acceso";
export const RUTA_CAMBIAR_CLAVE = "/postulacion/cambiar-clave";
export const RUTA_RECIBIDO = "/postulacion/recibido";

/** Acceso del personal (empleados): destino de su cierre de sesión. */
export const RUTA_LOGIN_PERSONAL = "/login";

/**
 * A dónde manda una sesión que terminó (inactividad, token vencido): el postulante vuelve a SU acceso
 * (con el aviso «Tu sesión terminó») y el empleado, al login del personal. Nunca se cruzan: sin rol conocido
 * (sesión ya anónima) se va al login del personal, que es el comportamiento de siempre.
 */
export function rutaTrasSesionTerminada(rol: string | undefined | null): string {
  return rol === ROL_POSTULANTE ? `${RUTA_ACCESO_POSTULANTE}?motivo=sesion` : RUTA_LOGIN_PERSONAL;
}

/** Rutas del personal a las que el empleado va cuando intenta entrar al área del postulante. */
const RUTA_INICIO_PERSONAL = "/dashboard";

/** Rutas de la app que un postulante puede abrir además de su área (PWA sin conexión). */
const RUTAS_COMUNES_PERMITIDAS: readonly string[] = ["/offline"];

export interface SesionRuta {
  rol: string | undefined;
  debeCambiarClave: boolean;
}

export type DecisionRuta =
  | { tipo: "no_aplica" }
  | { tipo: "continuar" }
  | { tipo: "redirigir"; destino: string };

const NO_APLICA: DecisionRuta = { tipo: "no_aplica" };
const CONTINUAR: DecisionRuta = { tipo: "continuar" };
const ir = (destino: string): DecisionRuta => ({ tipo: "redirigir", destino });

export function esRutaPostulacion(pathname: string): boolean {
  return pathname === RUTA_POSTULACION || pathname.startsWith(`${RUTA_POSTULACION}/`);
}

function normalizada(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function decidirRutaPostulacion(
  pathnameCrudo: string,
  sesion: SesionRuta | null,
): DecisionRuta {
  const pathname = normalizada(pathnameCrudo);
  const esPostulante = sesion?.rol === ROL_POSTULANTE;

  if (!esRutaPostulacion(pathname)) {
    // Fuera del área, el postulante solo puede volver a la suya; los demás siguen el flujo normal.
    if (!esPostulante || RUTAS_COMUNES_PERMITIDAS.includes(pathname)) return NO_APLICA;
    return ir(sesion.debeCambiarClave ? RUTA_CAMBIAR_CLAVE : RUTA_POSTULACION);
  }

  // Pantalla de «Recibido»: la sesión ya se cerró, por eso es pública.
  if (pathname === RUTA_RECIBIDO) return CONTINUAR;

  if (!sesion) {
    return pathname === RUTA_ACCESO_POSTULANTE ? CONTINUAR : ir(RUTA_ACCESO_POSTULANTE);
  }

  if (!esPostulante) return ir(RUTA_INICIO_PERSONAL);

  // Postulante con sesión. `acceso` queda abierta para poder reingresar si el token de Django cayó
  // antes que la sesión de NextAuth (si la redirigiéramos, habría un bucle).
  if (pathname === RUTA_ACCESO_POSTULANTE) return CONTINUAR;
  if (sesion.debeCambiarClave) {
    return pathname === RUTA_CAMBIAR_CLAVE ? CONTINUAR : ir(RUTA_CAMBIAR_CLAVE);
  }
  if (pathname === RUTA_CAMBIAR_CLAVE) return ir(RUTA_POSTULACION);
  return CONTINUAR;
}
