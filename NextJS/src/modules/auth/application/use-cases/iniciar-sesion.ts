/**
 * Caso de uso de inicio de sesión (paso 5-7 del checklist §II.8). Puro: recibe
 * el repositorio por parámetro (R4) y valida las credenciales mediante los
 * Value Objects del dominio antes de delegar.
 */
import { crearPasswordVO, crearUsuarioVO } from "../../domain/value-objects/credencial-vo";
import type { RepoAutenticacion } from "../../domain/ports/repo-auth";
import type { LoginDTO, SesionDTO } from "../dtos/login-dto";

export async function iniciarSesion(repo: RepoAutenticacion, dto: LoginDTO): Promise<SesionDTO> {
  const credenciales = {
    usuario: crearUsuarioVO(dto.usuario).value,
    password: crearPasswordVO(dto.password).value,
  };

  const sesion = await repo.iniciarSesion(credenciales);

  return {
    usuarioId: sesion.usuarioId,
    nombreCompleto: sesion.nombreCompleto,
    rolId: sesion.rol.id,
    rolNombre: sesion.rol.nombre,
    permisos: sesion.permisos.map((p) => ({ id: p.id, code: p.code, name: p.name })),
  };
}
