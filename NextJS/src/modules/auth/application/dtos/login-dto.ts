/**
 * DTOs del módulo auth (paso 4 del checklist §II.8). La capa `ui/` opera
 * exclusivamente con estas estructuras, nunca con entidades de dominio (R5).
 */

/** Entrada del caso de uso: credenciales crudas tal como llegan del formulario. */
export interface LoginDTO {
  readonly usuario: string;
  readonly password: string;
}

export interface PermisoDTO {
  id: number;
  code: string;
  name: string;
}

/** Salida del caso de uso: sesión lista para consumir desde la UI. */
export interface SesionDTO {
  usuarioId: number;
  nombreCompleto: string;
  rolId: number;
  rolNombre: string;
  permisos: PermisoDTO[];
}

/** Entrada del caso de uso `cambiarPassword`: valores crudos del formulario. */
export interface CambiarPasswordDTO {
  readonly passwordActual: string;
  readonly passwordNuevo: string;
}
