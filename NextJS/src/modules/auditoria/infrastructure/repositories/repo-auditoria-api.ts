/** Implementación del repositorio de auditoría con la API REST. */
import type {
  ArchivoAuditoriaDTO,
  DetalleAuditoriaDTO,
  FiltrosAuditoria,
  OpcionesAuditoriaDTO,
  PaginaAuditoriaDTO,
  PaginaIncidentesDTO,
} from "../../application/dtos/auditoria-dto";
import type { FormatoAuditoria, RepoAuditoria } from "../../domain/ports/repo-auditoria";
import { auditoriaApi } from "../http/auditoria-api";
import { descargarAuditoria } from "../http/auditoria-descargas-api";
import {
  detalleApiADTO,
  opcionesApiADTO,
  paginaApiADTO,
  paginaIncidentesApiADTO,
} from "../mappers/mapper-auditoria";

export const repoAuditoriaApi: RepoAuditoria = {
  async listar(filtros: FiltrosAuditoria, pagina: number, tamano: number): Promise<PaginaAuditoriaDTO> {
    const envelope = await auditoriaApi.listar(filtros, pagina, tamano);
    return paginaApiADTO(envelope.data);
  },

  async detalle(id: string): Promise<DetalleAuditoriaDTO> {
    const envelope = await auditoriaApi.detalle(id);
    return detalleApiADTO(envelope.data);
  },

  async opciones(): Promise<OpcionesAuditoriaDTO> {
    const envelope = await auditoriaApi.opciones();
    return opcionesApiADTO(envelope.data);
  },

  async incidentes(
    filtros: FiltrosAuditoria,
    pagina: number,
    tamano: number,
  ): Promise<PaginaIncidentesDTO> {
    const envelope = await auditoriaApi.incidentes(filtros, pagina, tamano);
    return paginaIncidentesApiADTO(envelope.data);
  },

  exportar(formato: FormatoAuditoria, filtros: FiltrosAuditoria): Promise<ArchivoAuditoriaDTO> {
    return descargarAuditoria(formato, filtros);
  },
};
