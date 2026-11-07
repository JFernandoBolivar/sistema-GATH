/**
 * Entidad de dominio del catálogo de roles (Regla R1), alineada a
 * `RolCatalogoLecturaSerializer`. No conoce HTTP ni DTOs.
 */
export interface RolEntity {
  readonly id: number;
  /** Código interno fijo (dato secundario; nunca la etiqueta principal). */
  readonly nombreRol: string;
  /** Nombre que ve el usuario. */
  readonly nombreVisible: string;
  readonly descripcionRol: string;
  readonly nUsuarios: number;
  readonly nPermisos: number;
}

export function createRolEntity(entity: RolEntity): RolEntity {
  if (!Number.isInteger(entity.id) || entity.id <= 0) {
    throw new Error("RolEntity inválido: id requerido");
  }
  return entity;
}
