/**
 * Puerto del Repositorio de Organización (Reglas R1, R4).
 *
 * Lee la estructura jerárquica y además persiste el CRUD de cada nivel
 * (dependencia, dirección general, dirección de línea, coordinación y
 * organismo adscrito), alineado a los ecenarios
 * `DependenciaCreateView/UpdateView/DeleteView` y análogos del backend.
 */
import type {
  Coordinacion,
  Dependencia,
  DireccionGeneral,
  DireccionLinea,
  OrganismoAdscrito,
} from "../entities/organizacion";

export interface GuardarDependencia {
  codigo: string;
  nombre: string;
}

export interface GuardarDireccionGeneral {
  codigo: string;
  nombre: string;
  dependenciaId: number | null;
}

export interface GuardarDireccionLinea {
  codigo: string;
  nombre: string;
  direccionGeneralId: number | null;
}

export interface GuardarCoordinacion {
  codigo: string;
  nombre: string;
  direccionLineaId: number | null;
}

export interface GuardarOrganismoAdscrito {
  nombre: string;
  parentId: number | null;
}

export interface RepoOrganizacion {
  listarDependencias(): Promise<Dependencia[]>;
  listarDireccionesGenerales(dependenciaId?: number): Promise<DireccionGeneral[]>;
  listarDireccionesLinea(direccionGeneralId?: number): Promise<DireccionLinea[]>;
  listarCoordinaciones(direccionLineaId?: number): Promise<Coordinacion[]>;
  listarOrganismosAdscritos(): Promise<OrganismoAdscrito[]>;

  crearDependencia(data: GuardarDependencia): Promise<Dependencia>;
  actualizarDependencia(id: number, data: GuardarDependencia): Promise<Dependencia>;
  eliminarDependencia(id: number): Promise<void>;

  crearDireccionGeneral(data: GuardarDireccionGeneral): Promise<DireccionGeneral>;
  actualizarDireccionGeneral(id: number, data: GuardarDireccionGeneral): Promise<DireccionGeneral>;
  eliminarDireccionGeneral(id: number): Promise<void>;

  crearDireccionLinea(data: GuardarDireccionLinea): Promise<DireccionLinea>;
  actualizarDireccionLinea(id: number, data: GuardarDireccionLinea): Promise<DireccionLinea>;
  eliminarDireccionLinea(id: number): Promise<void>;

  crearCoordinacion(data: GuardarCoordinacion): Promise<Coordinacion>;
  actualizarCoordinacion(id: number, data: GuardarCoordinacion): Promise<Coordinacion>;
  eliminarCoordinacion(id: number): Promise<void>;

  crearOrganismoAdscrito(data: GuardarOrganismoAdscrito): Promise<OrganismoAdscrito>;
  actualizarOrganismoAdscrito(id: number, data: GuardarOrganismoAdscrito): Promise<OrganismoAdscrito>;
  eliminarOrganismoAdscrito(id: number): Promise<void>;
}
