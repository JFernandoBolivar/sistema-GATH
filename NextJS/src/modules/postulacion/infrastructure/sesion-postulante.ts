/**
 * Lectura, EN EL SERVIDOR, del token de Django del postulante.
 *
 * El token vive solo dentro del JWT cifrado de NextAuth (cookie HttpOnly). La `session` que
 * `auth()` entrega al navegador no lo incluye (ver `auth.ts`), así que aquí se descifra la propia
 * cookie. Solo lo importan Server Actions y Server Components.
 */
import { cookies } from "next/headers";
import { decode } from "next-auth/jwt";
import type { SesionPostulanteJwt } from "../domain/sesion";
import { sesionVencida } from "../domain/vigencia-sesion";

const NOMBRES_COOKIE = ["__Secure-authjs.session-token", "authjs.session-token"] as const;

interface CookieLeida {
  name: string;
  value: string;
}

/** Une los fragmentos (`nombre.0`, `nombre.1`…) que Auth.js usa cuando la cookie excede 4 KB. */
export function valorDeCookieDeSesion(todas: CookieLeida[], nombre: string): string | null {
  const directa = todas.find((c) => c.name === nombre);
  if (directa) return directa.value;
  const trozos = todas
    .filter((c) => c.name.startsWith(`${nombre}.`))
    .sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop()));
  return trozos.length > 0 ? trozos.map((c) => c.value).join("") : null;
}

export async function leerSesionPostulante(): Promise<SesionPostulanteJwt | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const todas = (await cookies()).getAll();
  for (const nombre of NOMBRES_COOKIE) {
    const valor = valorDeCookieDeSesion(todas, nombre);
    if (!valor) continue;
    try {
      const jwt = await decode({ token: valor, secret, salt: nombre });
      const postulante = jwt?.postulante;
      if (postulante?.tokenDjango && !sesionVencida(postulante.expiraEl, Date.now())) {
        return postulante;
      }
    } catch {
      // Cookie ilegible o de otra clave: se trata como sin sesión.
    }
  }
  return null;
}
