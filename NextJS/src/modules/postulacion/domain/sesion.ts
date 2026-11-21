/**
 * Forma de la sesión del postulante dentro del JWT de NextAuth.
 * `tokenDjango` SOLO existe en el JWT cifrado (cookie HttpOnly): la `session` que llega al
 * navegador usa `SesionPostulantePublica`, sin el token.
 */

export interface SesionPostulanteJwt {
  /** Bearer del postulante en Django. Nunca sale del servidor. */
  tokenDjango: string;
  /** Vencimiento del token de Django, en segundos desde la época. */
  expiraEl: number;
  expedienteNumero: string;
  expedienteEstado: string;
  debeCambiarClave: boolean;
}

export type SesionPostulantePublica = Omit<SesionPostulanteJwt, "tokenDjango">;

export function aSesionPublica(s: SesionPostulanteJwt): SesionPostulantePublica {
  return {
    expiraEl: s.expiraEl,
    expedienteNumero: s.expedienteNumero,
    expedienteEstado: s.expedienteEstado,
    debeCambiarClave: s.debeCambiarClave,
  };
}
