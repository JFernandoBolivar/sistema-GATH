/**
 * Modelos serializables de la bitácora de auditoría (D10).
 *
 * Viven en `domain/` porque el puerto `RepoAuditoria` los usa: un `domain` no
 * puede depender de `application/` (S5-02). `application/dtos/auditoria-dto`
 * los reexporta para no romper los imports existentes.
 */

export interface FiltrosAuditoria {
  usuario?: string;
  accion?: string;
  modulo?: string;
  recurso?: string;
  ip?: string;
  desde?: string;
  hasta?: string;
  resultado?: string;
}

export interface RegistroAuditoriaDTO {
  id: string;
  fechaHora: string;
  actorCedula: string;
  actorNombre: string;
  actorRol: string;
  actorRolVisible?: string;
  modulo: string;
  accion: string;
  recursoTipo: string;
  recursoId: string;
  ip: string;
  userAgent: string;
  resultado: string;
}

export interface DiferenciaAuditoriaDTO {
  campo: string;
  antes: unknown;
  despues: unknown;
}

export interface DetalleAuditoriaDTO extends RegistroAuditoriaDTO {
  estadoPrevio: Record<string, unknown> | null;
  estadoNuevo: Record<string, unknown> | null;
  diferencias: DiferenciaAuditoriaDTO[];
}

export interface IncidenteSeguridadDTO {
  id: string;
  fechaHora: string;
  cedula: string;
  nombre: string;
  ip: string;
  resultado: string;
}

export interface PaginaAuditoriaDTO {
  resultados: RegistroAuditoriaDTO[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

export interface PaginaIncidentesDTO {
  resultados: IncidenteSeguridadDTO[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

export interface OpcionesAuditoriaDTO {
  acciones: string[];
  modulos: string[];
  resultados: string[];
}

export interface ArchivoAuditoriaDTO {
  blob: Blob;
  total: number | null;
  limite: number | null;
  truncado: boolean;
}
