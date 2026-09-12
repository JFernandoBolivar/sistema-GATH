/**
 * Caso de uso de cambio de contraseña de la cuenta autenticada. Puro: valida
 * ambas contraseñas con el mismo Value Object que usa el login (R1/R2, cero
 * regex inline) antes de delegar en el repositorio (R4).
 */
import { crearPasswordVO } from "../../domain/value-objects/credencial-vo";
import type { RepoAutenticacion } from "../../domain/ports/repo-auth";
import type { CambiarPasswordDTO } from "../dtos/login-dto";

export async function cambiarPassword(
  repo: RepoAutenticacion,
  dto: CambiarPasswordDTO,
): Promise<string> {
  const passwordActual = crearPasswordVO(dto.passwordActual).value;
  const passwordNuevo = crearPasswordVO(dto.passwordNuevo).value;

  return repo.cambiarPassword({ passwordActual, passwordNuevo });
}
