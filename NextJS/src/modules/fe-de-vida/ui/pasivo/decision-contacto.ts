/**
 * O39: decide las opciones del paso de contacto de la fe de vida.
 *
 * En línea el correo alternativo es obligatorio. En presencial se permite
 * «No tiene correo» con una justificación de al menos 10 caracteres.
 */
export const MIN_JUSTIFICACION_SIN_CORREO = 10;
export const MAX_JUSTIFICACION_SIN_CORREO = 500;

export interface OpcionesContacto {
  sinCorreoAlternativo: boolean;
  justificacionSinCorreo: string;
}

export interface EntradaContacto {
  correoAlternativo: string;
  permiteSinCorreo: boolean;
  sinCorreo: boolean;
  justificacion: string;
}

export type ResultadoContacto = { error: string } | { opciones: OpcionesContacto };

export function resolverOpcionesContacto(entrada: EntradaContacto): ResultadoContacto {
  if (entrada.permiteSinCorreo && entrada.sinCorreo) {
    const justificacion = entrada.justificacion.trim();
    if (justificacion.length < MIN_JUSTIFICACION_SIN_CORREO) {
      return {
        error: `La justificación de «sin correo» debe tener al menos ${MIN_JUSTIFICACION_SIN_CORREO} caracteres.`,
      };
    }
    return { opciones: { sinCorreoAlternativo: true, justificacionSinCorreo: justificacion } };
  }
  if (!entrada.correoAlternativo.trim()) {
    return { error: "El correo alternativo es obligatorio para la fe de vida." };
  }
  return { opciones: { sinCorreoAlternativo: false, justificacionSinCorreo: "" } };
}
