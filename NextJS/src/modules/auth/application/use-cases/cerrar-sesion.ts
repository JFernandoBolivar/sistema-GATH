/**
 * Caso de uso de cierre de sesión. Puro: delega en el repositorio (R4); la
 * limpieza de cookies/NextAuth es infraestructura y vive en
 * `infrastructure/actions/auth-actions.ts` (R3).
 */
import type { RepoAutenticacion } from "../../domain/ports/repo-auth";

export async function cerrarSesion(repo: RepoAutenticacion): Promise<void> {
  await repo.cerrarSesion();
}
