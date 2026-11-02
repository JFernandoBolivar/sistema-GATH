/**
 * Entidad inmutable de resultado de autenticación (paso 2 del checklist §II.8).
 * Representa la sesión obtenida tras un login exitoso: usuario autenticado, sus
 * permisos como códigos `{id, code, name}` (C-3) y su rol (solo informativo:
 * prohibido tomar decisiones por nombre de rol — R16).
 */
import type { UsuarioVO, PasswordVO } from "../value-objects/credencial-vo";

export interface PermisoEntity {
  readonly id: number;
  readonly code: string;
  readonly name: string;
}

export interface RolEntity {
  readonly id: number;
  readonly nombre: string;
}

export interface SesionEntity {
  readonly usuarioId: number;
  readonly nombreCompleto: string;
  readonly permisos: readonly PermisoEntity[];
  readonly rol: RolEntity;
}

export interface CredencialesLogin {
  readonly usuario: UsuarioVO["value"];
  readonly password: PasswordVO["value"];
}

export function createSesionEntity(entity: SesionEntity): SesionEntity {
  if (!Number.isInteger(entity.usuarioId) || entity.usuarioId <= 0) {
    throw new Error("SesionEntity inválido: usuarioId requerido");
  }
  if (!entity.nombreCompleto.trim()) {
    throw new Error("SesionEntity inválido: nombreCompleto requerido");
  }
  return entity;
}
