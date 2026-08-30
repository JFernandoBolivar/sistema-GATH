/**
 * Mappers del catálogo de identidad (roles, departamentos, permisos).
 */
import { createRolEntity, type RolEntity } from "../../domain/entities/rol-entity";
import type { DepartamentoEntity, PermisoEntity } from "../../domain/entities/departamento-entity";
import type { RolApiItem, DepartamentoApiItem, PermisoApiItem } from "../http/usuarios-api";

export function mapperRol(raw: RolApiItem): RolEntity {
  return createRolEntity({
    id: raw.id,
    nombreRol: raw.nombre_rol,
    descripcionRol: raw.descripcion_rol,
  });
}

export function mapperDepartamento(raw: DepartamentoApiItem): DepartamentoEntity {
  return { id: raw.id, nombre: raw.nombre, descripcion: raw.descripcion };
}

export function mapperPermiso(raw: PermisoApiItem): PermisoEntity {
  return { codigo: raw.codigo, nombre: raw.nombre };
}
