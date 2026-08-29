/**
 * Casos de uso de Reportes de Personal, Pasivos y Vacantes (Reglas R2, R4).
 */
import type { RepoReportes } from "../../domain/ports/repo-reportes";
import type {
  ReporteItemPasivoDTO,
  ReporteItemPersonalDTO,
  ReporteItemVacanteDTO,
} from "../dtos/reporte-dto";

export async function generarReportePersonal(
  repo: RepoReportes,
  filtros?: { dependenciaId?: number; tipoPersonalId?: number }
): Promise<ReporteItemPersonalDTO[]> {
  const entidades = await repo.generarReportePersonal(filtros);
  return entidades.map((e) => ({
    cedula: e.cedula,
    nombreCompleto: e.nombreCompleto,
    dependencia: e.dependencia,
    cargo: e.cargo,
    tipoPersonal: e.tipoPersonal,
    fechaIngreso: e.fechaIngreso,
    totalAnosApn: e.totalAnosApn,
  }));
}

export async function generarReportePasivos(
  repo: RepoReportes,
  filtros?: { tipoPersonalId?: number }
): Promise<ReporteItemPasivoDTO[]> {
  const entidades = await repo.generarReportePasivos(filtros);
  return entidades.map((e) => ({
    cedula: e.cedula,
    nombreCompleto: e.nombreCompleto,
    tipoPersonal: e.tipoPersonal,
    fechaEgreso: e.fechaEgreso,
    motivoEgreso: e.motivoEgreso,
  }));
}

export async function generarReporteVacantes(
  repo: RepoReportes,
  filtros?: { dependenciaId?: number }
): Promise<ReporteItemVacanteDTO[]> {
  const entidades = await repo.generarReporteVacantes(filtros);
  return entidades.map((e) => ({
    id: e.id,
    codigoNomina: e.codigoNomina,
    denominacionCargo: e.denominacionCargo,
    dependencia: e.dependencia,
    direccionGeneral: e.direccionGeneral,
  }));
}
