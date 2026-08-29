/**
 * Puerto del Repositorio de Organización (Reglas R1, R4).
 */
import type {
  Coordinacion,
  Dependencia,
  DireccionGeneral,
  DireccionLinea,
  OrganismoAdscrito,
} from "../entities/organizacion";

export interface RepoOrganizacion {
  listarDependencias(): Promise<Dependencia[]>;
  listarDireccionesGenerales(dependenciaId?: number): Promise<DireccionGeneral[]>;
  listarDireccionesLinea(direccionGeneralId?: number): Promise<DireccionLinea[]>;
  listarCoordinaciones(direccionLineaId?: number): Promise<Coordinacion[]>;
  listarOrganismosAdscritos(): Promise<OrganismoAdscrito[]>;
}
