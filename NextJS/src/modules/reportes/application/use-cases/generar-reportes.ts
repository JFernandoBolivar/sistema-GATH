/**
 * Casos de uso de Reportes de Personal, Pasivos y Vacantes (Reglas R2, R4).
 */
import type { RepoReportes } from "../../domain/ports/repo-reportes";
import type {
  DistribucionNominaDTO,
  ReporteItemCodigoDTO,
  ReporteItemFamiliarDTO,
  ReporteItemPasivoDTO,
  ReporteItemPersonalDTO,
  ReporteItemVacanteDTO,
  TendenciaPeriodoDTO,
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
  filtros?: { tipoPersonalId?: number; fechaEgresoDesde?: string; fechaEgresoHasta?: string }
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

export async function generarReporteFamiliares(
  repo: RepoReportes,
  filtros?: { parentescoId?: number; sexoId?: number }
): Promise<ReporteItemFamiliarDTO[]> {
  const entidades = await repo.generarReporteFamiliares(filtros);
  return entidades.map((e) => ({
    cedulaFamiliar: e.cedulaFamiliar,
    nombres: e.nombres,
    apellidos: e.apellidos,
    parentesco: e.parentesco,
    sexo: e.sexo,
    fechaNacimiento: e.fechaNacimiento,
    cedulaEmpleado: e.cedulaEmpleado,
  }));
}

export async function generarReporteCodigos(
  repo: RepoReportes,
  filtros?: { dependenciaId?: number; nominaId?: number }
): Promise<ReporteItemCodigoDTO[]> {
  const entidades = await repo.generarReporteCodigos(filtros);
  return entidades.map((e) => ({
    codigo: e.codigo,
    cargo: e.cargo,
    cargoEspecifico: e.cargoEspecifico,
    tipoNomina: e.tipoNomina,
    dependencia: e.dependencia,
    direccionGeneral: e.direccionGeneral,
    estatus: e.estatus,
  }));
}

export async function obtenerTendenciasPersonal(
  repo: RepoReportes
): Promise<TendenciaPeriodoDTO[]> {
  const entidades = await repo.obtenerTendenciasPersonal();
  return entidades.map((e) => ({
    periodo: e.periodo,
    ingresos: e.ingresos,
    egresos: e.egresos,
  }));
}

export async function obtenerDistribucionNomina(
  repo: RepoReportes
): Promise<DistribucionNominaDTO[]> {
  const entidades = await repo.obtenerDistribucionNomina();
  return entidades.map((e) => ({
    tipoNomina: e.tipoNomina,
    total: e.total,
  }));
}
