/**
 * Traducción de errores del cliente HTTP a respuestas de las rutas API (F2-06).
 *
 * Las rutas de Next devolvían siempre 500 y, en las descargas, un JSON de error
 * con extensión `.xlsx`. Aquí se conserva el código real del backend para que el
 * navegador muestre el error como error y no como un archivo corrupto.
 */
import { ApiHttpError, SessionExpiredError } from "./errors";

export function estadoDeError(error: unknown): number {
  if (error instanceof ApiHttpError) return error.status;
  if (error instanceof SessionExpiredError) return 401;
  return 500;
}

export function mensajeDeError(error: unknown, porDefecto: string): string {
  return error instanceof Error && error.message ? error.message : porDefecto;
}
