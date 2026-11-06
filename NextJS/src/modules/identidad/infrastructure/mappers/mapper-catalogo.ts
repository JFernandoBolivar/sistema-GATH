/**
 * Mappers del catálogo de identidad (roles y permisos).
 */
import { createRolEntity, type RolEntity } from "../../domain/entities/rol-entity";
import type { PermisoEntity } from "../../domain/entities/departamento-entity";
import type { RolApiItem, PermisoApiItem } from "../http/usuarios-api";

export function mapperRol(raw: RolApiItem): RolEntity {
  return createRolEntity({
    id: raw.id,
    nombreRol: raw.nombre_rol,
    descripcionRol: raw.descripcion_rol,
    nUsuarios: raw.n_usuarios ?? 0,
    nPermisos: raw.n_permisos ?? 0,
  });
}

export function mapperPermiso(raw: PermisoApiItem): PermisoEntity {
  return { codigo: raw.codigo, nombre: raw.nombre };
}
