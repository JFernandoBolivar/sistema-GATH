import { useSession } from "next-auth/react";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import type { ResultadoNotificacion } from "../application/dtos/notificacion-dto";
import type { ModuloNotificaciones } from "../domain/entities/notificacion";

export const PERMISO_NOTIFICACIONES = "notificaciones.ver_propias";
const PERMISO_AUTOGESTION = "autogestion.ver_propio";

/** Todas las claves SWR del módulo empiezan por este prefijo para poder refrescarlas juntas. */
export const PREFIJO_CLAVES = "notificaciones/";
export const claveConteo = (modulo: ModuloNotificaciones) => `${PREFIJO_CLAVES}conteo/${modulo}`;
export const claveRecientes = (modulo: ModuloNotificaciones) =>
  `${PREFIJO_CLAVES}recientes/${modulo}`;
export const claveBandeja = (modulo: ModuloNotificaciones, filtros: object) =>
  `${PREFIJO_CLAVES}bandeja/${modulo}/${JSON.stringify(filtros)}`;

/** Intervalo del sondeo del contador (ms). Además se revalida al recuperar el foco. */
export const INTERVALO_SONDEO_MS = 60_000;

export const esClaveDeNotificaciones = (clave: unknown): boolean =>
  typeof clave === "string" && clave.startsWith(PREFIJO_CLAVES);

/** Desenvuelve el resultado de una Server Action para usarlo como fetcher de SWR. */
export function desenvolver<T>(res: ResultadoNotificacion<T>): T {
  if (!res.ok) throw new Error(res.mensaje);
  return res.datos;
}

/** `true` si la sesión tiene el permiso por código; sin él no se consulta nada ni se hace polling. */
export function usePuedeVerNotificaciones(): boolean {
  const { data: session } = useSession();
  return tienePermiso(session?.user?.permisos, PERMISO_NOTIFICACIONES);
}

/** Un enlace al área de Autogestión solo se ofrece si el usuario tiene acceso a ella. */
export function usePuedeAbrirEnlace(): (enlace: string) => boolean {
  const { data: session } = useSession();
  return (enlace) =>
    !enlace.startsWith("/autogestion") ||
    tienePermiso(session?.user?.permisos, PERMISO_AUTOGESTION);
}
