/**
 * Casos de uso de listado y catálogos del módulo identidad (Reglas R2, R4).
 */
import type { RepoUsuarios } from "../../domain/ports/repo-usuarios";
import type {
  PaginaUsuariosDTO,
  PermisoDTO,
  UsuarioDetalleDTO,
  UsuariosFiltrosDTO,
} from "../dtos/usuario-dto";
import type { UsuarioEntity } from "../../domain/entities/usuario-entity";
import type { PermisoEntity } from "../../domain/entities/departamento-entity";

export function aUsuarioDto(u: UsuarioEntity) {
  return {
    id: u.id,
    cedula: u.cedula,
    nombres: u.nombres,
    apellidos: u.apellidos,
    correo: u.correo,
    correoAlternativo: u.correoAlternativo,
    telefono: u.telefono,
    rolId: u.rolId,
    rolNombre: u.rolNombre,
    isActive: u.isActive,
    ultimoAcceso: u.ultimoAcceso,
    condicion: u.condicion,
    passwordInicialPendiente: u.passwordInicialPendiente,
  };
}

export async function listarUsuarios(
  repo: RepoUsuarios,
  filtros?: UsuariosFiltrosDTO,
): Promise<PaginaUsuariosDTO> {
  const pagina = await repo.getAll({
    cedula: filtros?.cedula,
    nombre: filtros?.nombre,
    correo: filtros?.correo,
    rolId: filtros?.rolId,
    isActive: filtros?.isActive,
    condicion: filtros?.condicion,
    pagina: filtros?.pagina,
    pageSize: filtros?.pageSize,
  });
  return {
    resultados: pagina.resultados.map(aUsuarioDto),
    total: pagina.total,
    pagina: pagina.pagina,
    tamano: pagina.tamano,
    totalPaginas: pagina.totalPaginas,
  };
}

export async function obtenerDetalleUsuario(
  repo: RepoUsuarios,
  id: number,
): Promise<UsuarioDetalleDTO> {
  const detalle = await repo.obtenerDetalle(id);
  return {
    ...aUsuarioDto(detalle.usuario),
    permisos: {
      rolId: detalle.permisos.rolId,
      rolNombre: detalle.permisos.rolNombre,
      delRol: detalle.permisos.delRol,
      allow: detalle.permisos.allow,
      deny: detalle.permisos.deny,
      efectivos: detalle.permisos.efectivos,
      version: detalle.permisos.version,
    },
  };
}

export async function listarPermisos(repo: RepoUsuarios): Promise<PermisoDTO[]> {
  const entities = await repo.listarPermisos();
  return entities.map((e: PermisoEntity) => ({ codigo: e.codigo, nombre: e.nombre }));
}
