/**
 * Entidad inmutable Usuario del módulo identidad (paso 2 del checklist §II.8).
 * No conoce HTTP ni DTOs: es el modelo puro del dominio.
 */
import type { CedulaVO } from "../value-objects/cedula-vo";

export interface UsuarioEntity {
  readonly id: number;
  readonly cedula: CedulaVO["value"];
  readonly nombres: string;
  readonly apellidos: string;
  readonly correo: string;
}

export function createUsuarioEntity(entity: UsuarioEntity): UsuarioEntity {
  if (!Number.isInteger(entity.id) || entity.id <= 0) {
    throw new Error("UsuarioEntity inválido: id requerido");
  }
  return entity;
}
