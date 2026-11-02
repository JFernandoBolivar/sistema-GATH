/**
 * Entidad de dominio del catálogo de roles (Regla R1), alineada a
 * `RolCatalogoLecturaSerializer`. No conoce HTTP ni DTOs.
 */
export interface RolEntity {
  readonly id: number;
  readonly nombreRol: string;
  readonly descripcionRol: string;
}

export function createRolEntity(entity: RolEntity): RolEntity {
  if (!Number.isInteger(entity.id) || entity.id <= 0) {
    throw new Error("RolEntity inválido: id requerido");
  }
  return entity;
}
