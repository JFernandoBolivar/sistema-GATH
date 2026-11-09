/** Puerto del repositorio de auditoría (D10, solo lectura). */
import type {
  ArchivoAuditoriaDTO,
  DetalleAuditoriaDTO,
  FiltrosAuditoria,
  OpcionesAuditoriaDTO,
  PaginaAuditoriaDTO,
  PaginaIncidentesDTO,
} from "../../application/dtos/auditoria-dto";

export type FormatoAuditoria = "pdf" | "excel";

export interface RepoAuditoria {
  listar(filtros: FiltrosAuditoria, pagina: number, tamano: number): Promise<PaginaAuditoriaDTO>;
  detalle(id: string): Promise<DetalleAuditoriaDTO>;
  opciones(): Promise<OpcionesAuditoriaDTO>;
  incidentes(
    filtros: FiltrosAuditoria,
    pagina: number,
    tamano: number,
  ): Promise<PaginaIncidentesDTO>;
  exportar(formato: FormatoAuditoria, filtros: FiltrosAuditoria): Promise<ArchivoAuditoriaDTO>;
}
