/**
 * Entidad inmutable Usuario del módulo identidad (paso 2 del checklist §II.8).
 * Alineada a `CuentaLecturaSerializer` del backend. No conoce HTTP ni DTOs.
 *
 * D3: sin departamento. La condición ACTIVO/PASIVO es un dato derivado y el
 * acceso se decide por rol + permisos.
 */
import type { CedulaVO } from "../value-objects/cedula-vo";

export interface UsuarioEntity {
  readonly id: number;
  readonly cedula: CedulaVO["value"];
  readonly nombres: string;
  readonly apellidos: string;
  readonly correo: string | null;
  readonly correoAlternativo?: string | null;
  readonly telefono: string | null;
  readonly rolId: number | null;
  readonly rolNombre: string | null;
  readonly rolNombreVisible?: string | null;
  readonly isActive: boolean;
  readonly ultimoAcceso: string | null;
  readonly condicion: string | null;
  readonly passwordInicialPendiente: boolean;
}

export function createUsuarioEntity(entity: UsuarioEntity): UsuarioEntity {
  if (!Number.isInteger(entity.id) || entity.id <= 0) {
    throw new Error("UsuarioEntity inválido: id requerido");
  }
  return entity;
}
