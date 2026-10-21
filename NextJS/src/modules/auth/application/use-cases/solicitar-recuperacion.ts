import type { RepoAutenticacion } from "../../domain/ports/repo-auth";

/**
 * Caso de uso: Solicitar correo de recuperación de contraseña.
 * Despacha la solicitud al repositorio de autenticación.
 */
export async function solicitarRecuperacion(
  repo: RepoAutenticacion,
  identificador: string,
): Promise<string> {
  const limpio = identificador.trim();
  if (!limpio) {
    throw new Error("El identificador es requerido.");
  }
  return repo.solicitarRecuperacion(limpio);
}
