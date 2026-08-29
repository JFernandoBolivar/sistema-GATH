/**
 * DTOs del módulo identidad (paso 4 del checklist §II.8). La capa `ui/` opera
 * exclusivamente con estas estructuras, nunca con entidades de dominio (R5).
 */

export interface UsuarioItemDTO {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string;
}

/** Filtros opcionales del listado, ya validados y saneados. */
export interface UsuariosFiltroDTO {
  busqueda?: string;
}
