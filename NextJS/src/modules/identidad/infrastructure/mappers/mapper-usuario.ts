/**
 * Mapper del módulo identidad (Regla R3). Traduce las filas crudas del backend
 * (sobre C-1) a la entidad de dominio inmutable.
 */
import { createUsuarioEntity, type UsuarioEntity } from "../../domain/entities/usuario-entity";
import type { UsuarioApiItem } from "../http/usuarios-api";

/** Fila cruda del backend → entidad de dominio (tolerante a campos ausentes). */
export function mapperUsuario(raw: UsuarioApiItem): UsuarioEntity {
  return createUsuarioEntity({
    id: Number(raw.id ?? 0),
    cedula: raw.cedula ?? "",
    nombres: raw.nombres ?? "",
    apellidos: raw.apellidos ?? "",
    correo: raw.correo ?? null,
    correoAlternativo: raw.correo_alternativo ?? null,
    telefono: raw.telefono ?? null,
    rolId: raw.rol_id ?? null,
    rolNombre: raw.rol_nombre ?? null,
    isActive: raw.is_active ?? false,
    ultimoAcceso: raw.ultimo_acceso ?? null,
    condicion: raw.condicion ?? null,
    passwordInicialPendiente: raw.password_inicial_pendiente ?? false,
  });
}
