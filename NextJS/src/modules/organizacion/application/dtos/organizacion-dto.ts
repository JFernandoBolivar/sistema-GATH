/**
 * DTOs de Organización (Regla R5). La capa `ui/` opera exclusivamente con
 * estas estructuras y nunca usa entidades de dominio.
 *
 * Los DTOs de escritura (`GuardarImput*`) replican los Write serializers del
 * backend: `codigo` + `nombre` para dependencias, y los identificadores de
 * jerarquía (`dependenciaId`, `direccionGeneralId`, `direccionLineaId`,
 * `parentId`) cuando aplican.
 */
export interface DependenciaDTO {
  id: number;
  codigo?: string;
  nombre: string;
}

export interface DireccionGeneralDTO {
  id: number;
  codigo?: string;
  nombre: string;
  dependenciaId: number | null;
}

export interface DireccionLineaDTO {
  id: number;
  codigo?: string;
  nombre: string;
  direccionGeneralId: number | null;
}

export interface CoordinacionDTO {
  id: number;
  codigo?: string;
  nombre: string;
  direccionLineaId: number | null;
}

export interface OrganismoAdscritoDTO {
  id: number;
  nombre: string;
  parentId?: number | null;
}

export interface GuardarDependenciaInputDTO {
  codigo: string;
  nombre: string;
}

export interface GuardarDireccionGeneralInputDTO {
  codigo: string;
  nombre: string;
  dependenciaId: number | null;
}

export interface GuardarDireccionLineaInputDTO {
  codigo: string;
  nombre: string;
  direccionGeneralId: number | null;
}

export interface GuardarCoordinacionInputDTO {
  codigo: string;
  nombre: string;
  direccionLineaId: number | null;
}

export interface GuardarOrganismoAdscritoInputDTO {
  nombre: string;
  parentId: number | null;
}
