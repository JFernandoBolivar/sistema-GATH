/**
 * Puerto del Repositorio de Reportes (Reglas R1, R4).
 */
import type {
  ReporteItemPasivo,
  ReporteItemPersonal,
  ReporteItemVacante,
} from "../entities/reporte";
import type { TipoReportePersonal } from "../value-objects/tipo-reporte-vo";

export interface RepoReportes {
  generarReportePersonal(filtros?: { dependenciaId?: number; tipoPersonalId?: number }): Promise<ReporteItemPersonal[]>;
  generarReportePasivos(filtros?: { tipoPersonalId?: number }): Promise<ReporteItemPasivo[]>;
  generarReporteVacantes(filtros?: { dependenciaId?: number }): Promise<ReporteItemVacante[]>;
  descargarPdf(tipo: TipoReportePersonal): Promise<Blob>;
  descargarExcel(tipo: TipoReportePersonal): Promise<Blob>;
}
