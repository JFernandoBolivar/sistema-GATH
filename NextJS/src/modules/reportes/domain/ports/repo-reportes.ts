/**
 * Puerto del Repositorio de Reportes (Reglas R1, R4).
 */
import type {
  ReporteItemCodigo,
  ReporteItemFamiliar,
  ReporteItemPasivo,
  ReporteItemPersonal,
  ReporteItemVacante,
  TendenciaPeriodo,
} from "../entities/reporte";
import type { TipoReportePersonal } from "../value-objects/tipo-reporte-vo";

export interface RepoReportes {
  generarReportePersonal(filtros?: { dependenciaId?: number; tipoPersonalId?: number }): Promise<ReporteItemPersonal[]>;
  generarReportePasivos(filtros?: { tipoPersonalId?: number }): Promise<ReporteItemPasivo[]>;
  generarReporteVacantes(filtros?: { dependenciaId?: number }): Promise<ReporteItemVacante[]>;
  generarReporteFamiliares(filtros?: { parentescoId?: number; sexoId?: number }): Promise<ReporteItemFamiliar[]>;
  generarReporteCodigos(filtros?: { dependenciaId?: number; nominaId?: number }): Promise<ReporteItemCodigo[]>;
  obtenerTendenciasPersonal(): Promise<TendenciaPeriodo[]>;
  descargarPdf(tipo: TipoReportePersonal): Promise<Blob>;
  descargarExcel(tipo: TipoReportePersonal): Promise<Blob>;
}
