/** Descarga de la bitácora desde la pantalla (D10), por el handler del mismo origen. */
import type { ArchivoAuditoriaDTO, FiltrosAuditoria } from "../../application/dtos/auditoria-dto";
import type { FormatoAuditoria } from "../../domain/ports/repo-auditoria";
import { descargarAuditoria } from "../../infrastructure/http/auditoria-descargas-api";

export function descargarBitacora(
  formato: FormatoAuditoria,
  filtros: FiltrosAuditoria,
): Promise<ArchivoAuditoriaDTO> {
  return descargarAuditoria(formato, filtros);
}
