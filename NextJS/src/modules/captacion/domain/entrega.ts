/**
 * Entrega del acceso al postulante (D-10): en persona (contraseña temporal mostrada una vez) o por correo
 * (enlace de activación; el correo nunca lleva contraseña).
 */
import { EMAIL } from "@/shared/domain/validation";

export type TipoEntrega = "persona" | "correo";

export const ENTREGA_PERSONA: TipoEntrega = "persona";
export const ENTREGA_CORREO: TipoEntrega = "correo";

export const RECORDATORIO_CORREO = "Confirma el correo con la persona antes de enviar";

/** Un correo sirve para el envío si tiene forma válida (el backend vuelve a comprobarlo). */
export function correoUtilizable(correo: string | null | undefined): boolean {
  const limpio = (correo ?? "").trim();
  return limpio !== "" && EMAIL.test(limpio);
}

/** `juan.perez@gmail.com` -> `ju***@gmail.com` (misma regla que el backend para el historial visible). */
export function enmascararCorreo(correo: string | null | undefined): string {
  const limpio = (correo ?? "").trim();
  const arroba = limpio.indexOf("@");
  if (arroba < 0) return "***";
  return `${limpio.slice(0, Math.min(2, arroba))}***${limpio.slice(arroba)}`;
}

/** Sin correo válido solo queda la entrega en persona. */
export function entregaEfectiva(elegida: TipoEntrega, correo: string | null | undefined): TipoEntrega {
  return elegida === ENTREGA_CORREO && !correoUtilizable(correo) ? ENTREGA_PERSONA : elegida;
}
