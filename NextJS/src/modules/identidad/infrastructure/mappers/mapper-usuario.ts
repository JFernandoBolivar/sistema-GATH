/**
 * Mapper del módulo identidad (paso 8 del checklist §II.8). Traduce las filas
 * crudas del backend (sobre C-1) a la entidad de dominio inmutable.
 */
import { createUsuarioEntity, type UsuarioEntity } from "../../domain/entities/usuario-entity";

/** Forma esperada de cada fila en `data` del endpoint de usuarios. */
export interface UsuarioBackendPayload {
  id?: number;
  cedula?: string;
  cedula_identidad?: string;
  nombres?: string;
  apellidos?: string;
  correo?: string;
  email?: string;
}

/** Fila cruda del backend → entidad de dominio (tolerante a campos ausentes). */
export function mapperUsuario(raw: UsuarioBackendPayload): UsuarioEntity {
  return createUsuarioEntity({
    id: Number(raw.id ?? 0),
    cedula: raw.cedula ?? raw.cedula_identidad ?? "",
    nombres: raw.nombres ?? "",
    apellidos: raw.apellidos ?? "",
    correo: raw.correo ?? raw.email ?? "",
  });
}
