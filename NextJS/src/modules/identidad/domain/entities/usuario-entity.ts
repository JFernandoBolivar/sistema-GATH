/**
 * Entidad inmutable Usuario del módulo identidad (paso 2 del checklist §II.8).
 * Alineada a `CuentaLecturaSerializer` del backend. No conoce HTTP ni DTOs.
 */
import type { CedulaVO } from "../value-objects/cedula-vo";

export interface UsuarioEntity {
  readonly id: number;
  readonly cedula: CedulaVO["value"];
  readonly nombres: string;
  readonly apellidos: string;
  readonly correo: string | null;
  readonly telefono: string | null;
  readonly departamentoId: number | null;
  readonly rolId: number | null;
  readonly isActive: boolean;
  readonly debeCambiarPassword: boolean | null;
}

export function createUsuarioEntity(entity: UsuarioEntity): UsuarioEntity {
  if (!Number.isInteger(entity.id) || entity.id <= 0) {
    throw new Error("UsuarioEntity inválido: id requerido");
  }
  return entity;
}
