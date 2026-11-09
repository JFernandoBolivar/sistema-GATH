import type { RepoAutenticacion, RestablecerPasswordInput } from "../../domain/ports/repo-auth";

/**
 * Caso de uso: Restablecer contraseña utilizando un token firmado de un solo uso.
 */
export async function restablecerPassword(
  repo: RepoAutenticacion,
  input: RestablecerPasswordInput,
): Promise<string> {
  if (!input.token?.trim()) {
    throw new Error("El token de recuperación es requerido.");
  }
  if (!input.passwordNuevo) {
    throw new Error("La nueva contraseña es requerida.");
  }
  if (input.passwordNuevo !== input.passwordConfirmacion) {
    throw new Error("Las contraseñas no coinciden.");
  }
  return repo.restablecerPassword(input);
}
