/**
 * Mapper del módulo auth (paso 8 del checklist §II.8). Traduce la respuesta
 * cruda del backend (sobre C-1) a la entidad de dominio y de la entidad al DTO
 * que consume la UI.
 */
import {
  createSesionEntity,
  type PermisoEntity,
  type RolEntity,
  type SesionEntity,
} from "../../domain/entities/sesion-entity";
import type { PermisoDTO, SesionDTO } from "../../application/dtos/login-dto";

/** Forma esperada de `data` en la respuesta del endpoint de login. */
export interface SesionBackendPayload {
  usuarioId?: number;
  id?: number;
  nombres?: string;
  apellidos?: string;
  nombreCompleto?: string;
  rol?: Partial<RolEntity>;
  permisos?: Array<Partial<PermisoEntity>>;
}

function mapPermiso(raw: Partial<PermisoEntity>): PermisoEntity {
  return { id: Number(raw.id ?? 0), code: String(raw.code ?? ""), name: String(raw.name ?? "") };
}

/** Respuesta C-1 (`data`) → entidad de dominio inmutable. */
export function mapperSesion(raw: SesionBackendPayload): SesionEntity {
  const nombreCompleto =
    raw.nombreCompleto?.trim() ||
    `${raw.nombres ?? ""} ${raw.apellidos ?? ""}`.trim();

  return createSesionEntity({
    usuarioId: Number(raw.usuarioId ?? raw.id ?? 0),
    nombreCompleto,
    rol: { id: Number(raw.rol?.id ?? 0), nombre: String(raw.rol?.nombre ?? "") },
    permisos: (raw.permisos ?? []).map(mapPermiso),
  });
}

/** Entidad de dominio → DTO para la capa `ui/` (R5). */
export function toSesionDTO(entity: SesionEntity): SesionDTO {
  const permisos: PermisoDTO[] = entity.permisos.map((p) => ({ ...p }));
  return {
    usuarioId: entity.usuarioId,
    nombreCompleto: entity.nombreCompleto,
    rolId: entity.rol.id,
    rolNombre: entity.rol.nombre,
    permisos,
  };
}
