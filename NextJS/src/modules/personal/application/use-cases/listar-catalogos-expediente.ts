/**
 * Caso de uso de catálogos de soporte del expediente (Reglas R2, R4).
 */
import type { CatalogosExpediente, RepoPersonal } from "../../domain/ports/repo-personal";
import type { CatalogosExpedienteDTO } from "../dtos/empleado-dto";

export async function listarCatalogosExpediente(
  repo: RepoPersonal,
): Promise<CatalogosExpedienteDTO> {
  const c: CatalogosExpediente = await repo.listarCatalogosExpediente();
  return {
    estados: c.estados.map((x) => ({ id: x.id, nombre: x.nombre })),
    municipios: c.municipios.map((x) => ({ id: x.id, nombre: x.nombre })),
    parroquias: c.parroquias.map((x) => ({ id: x.id, nombre: x.nombre })),
    condicionesVivienda: c.condicionesVivienda.map((x) => ({ id: x.id, nombre: x.nombre })),
    codigosPostales: c.codigosPostales.map((x) => ({ id: x.id, nombre: x.nombre })),
    gruposSanguineos: c.gruposSanguineos.map((x) => ({ id: x.id, nombre: x.nombre })),
    nivelesAcademicos: c.nivelesAcademicos.map((x) => ({ id: x.id, nombre: x.nombre })),
    carreras: c.carreras.map((x) => ({ id: x.id, nombre: x.nombre })),
    menciones: c.menciones.map((x) => ({ id: x.id, nombre: x.nombre })),
    instituciones: c.instituciones.map((x) => ({ id: x.id, nombre: x.nombre })),
    capacitaciones: c.capacitaciones.map((x) => ({ id: x.id, nombre: x.nombre })),
    gruposCapacitacion: c.gruposCapacitacion.map((x) => ({ id: x.id, nombre: x.nombre })),
    tiposProcedencia: c.tiposProcedencia.map((x) => ({ id: x.id, nombre: x.nombre })),
    tiposPrenda: c.tiposPrenda.map((x) => ({ id: x.id, nombre: x.nombre })),
    tallas: c.tallas.map((x) => ({ id: x.id, nombre: x.nombre })),
    politicas: c.politicas.map((x) => ({ id: x.id, nombre: x.nombre })),
    alergias: c.alergias.map((x) => ({ id: x.id, nombre: x.nombre })),
    patologias: c.patologias.map((x) => ({ id: x.id, nombre: x.nombre })),
    discapacidades: c.discapacidades.map((x) => ({ id: x.id, nombre: x.nombre })),
    sexos: (c.sexos ?? []).map((x) => ({ id: x.id, nombre: x.nombre })),
    estadosCiviles: (c.estadosCiviles ?? []).map((x) => ({ id: x.id, nombre: x.nombre })),
    organismos: (c.organismos ?? []).map((x) => ({ id: x.id, nombre: x.nombre })),
  };
}
