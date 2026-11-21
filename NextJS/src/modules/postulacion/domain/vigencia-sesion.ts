/**
 * La sesión del postulante nunca dura más que el token de Django (`expira_el`, ≤ 2 h).
 * `maxAge` se calcula en segundos para el cifrado del JWT de NextAuth.
 */

export function segundosRestantes(expiraEl: number, ahoraMs: number): number {
  return Math.floor(expiraEl - ahoraMs / 1000);
}

export function sesionVencida(expiraEl: number, ahoraMs: number): boolean {
  return segundosRestantes(expiraEl, ahoraMs) <= 0;
}

/** `maxAge` del JWT: el menor entre el de la app y lo que queda del token de invitado (mínimo 1 s). */
export function maxAgeDeSesion(
  postulante: { expiraEl: number } | null | undefined,
  maxAgeGeneral: number,
  ahoraMs: number,
): number {
  if (!postulante) return maxAgeGeneral;
  return Math.max(1, Math.min(maxAgeGeneral, segundosRestantes(postulante.expiraEl, ahoraMs)));
}
