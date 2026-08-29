/**
 * Caso de uso de listado de usuarios (paso 5 del checklist §II.8). Puro:
 * recibe el repositorio por parámetro (R4) y devuelve DTOs para la UI (R5).
 */
import type { RepoUsuarios } from "../../domain/ports/repo-usuarios";
import type { UsuarioItemDTO } from "../dtos/usuario-dto";

export async function listarUsuarios(
  repo: RepoUsuarios,
  filtros?: { readonly busqueda?: string },
): Promise<UsuarioItemDTO[]> {
  const entities = await repo.getAll(filtros);
  return entities.map((u) => ({
    id: u.id,
    cedula: u.cedula,
    nombres: u.nombres,
    apellidos: u.apellidos,
    correo: u.correo,
  }));
}
