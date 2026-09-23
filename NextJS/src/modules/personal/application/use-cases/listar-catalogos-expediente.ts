/**
 * Caso de uso de catálogos de soporte del expediente (Reglas R2, R4).
 */
import type { CatalogosExpediente, RepoPersonal } from "../../domain/ports/repo-personal";
import type { CatalogosExpedienteDTO } from "../dtos/empleado-dto";

export async function listarCatalogosExpediente(
  repo: RepoPersonal,
): Promise<CatalogosExpedienteDTO> {
  const c: CatalogosExpediente = await repo.listarCatalogosExpediente();
  const mapCat = (items: typeof c.estados) =>
    (items ?? []).map((x) => ({
      id: x.id,
      nombre: x.nombre,
      codigo: x.codigo ?? null,
      categoriaId: x.categoriaId ?? null,
      categoriaNombre: x.categoriaNombre ?? null,
      tipoPrendaId: x.tipoPrendaId ?? null,
      tipoPrendaNombre: x.tipoPrendaNombre ?? null,
      regionId: x.regionId ?? null,
      regionCodigo: x.regionCodigo ?? null,
      regionDescripcion: x.regionDescripcion ?? null,
    }));
  return {
    estados: mapCat(c.estados),
    municipios: mapCat(c.municipios),
    parroquias: mapCat(c.parroquias),
    condicionesVivienda: mapCat(c.condicionesVivienda),
    codigosPostales: mapCat(c.codigosPostales),
    gruposSanguineos: mapCat(c.gruposSanguineos),
    nivelesAcademicos: mapCat(c.nivelesAcademicos),
    carreras: mapCat(c.carreras),
    menciones: mapCat(c.menciones),
    instituciones: mapCat(c.instituciones),
    capacitaciones: mapCat(c.capacitaciones),
    gruposCapacitacion: mapCat(c.gruposCapacitacion),
    tiposProcedencia: mapCat(c.tiposProcedencia),
    tiposPrenda: mapCat(c.tiposPrenda),
    tallas: mapCat(c.tallas),
    politicas: mapCat(c.politicas),
    alergias: mapCat(c.alergias),
    patologias: mapCat(c.patologias),
    discapacidades: mapCat(c.discapacidades),
    sexos: mapCat(c.sexos),
    estadosCiviles: mapCat(c.estadosCiviles),
    organismos: mapCat(c.organismos),
  };
}
