/**
 * Puerto del Repositorio de Cargos (Reglas R1, R4). Implícitamente expone el
 * contrato del backend de `apps.cargos`:
 *
 * - `listarCargos` → CargoAsignacionSerializer
 * - `listarDenominaciones`/`especificas` → DenominacionSerializer
 * - `prestamos` → PrestamoCargoSerializer
 */
import type {
  CargoAsignacion,
  CatalogoCargoItem,
  DenominacionCargo,
  PrestamoCargo,
  UnidadOrganizativaCargo,
} from "../entities/cargo";

/** Datos de entrada para crear/actualizar una denominación de cargo (Regla R1: tipo propio de domain/). */
export interface DenominacionInput {
  nombre: string;
  orden: number;
}

/** Datos de entrada para crear un préstamo de cargo (encargaduría) (Regla R1: tipo propio de domain/). */
export interface CrearPrestamoInput {
  cedulaEncargado: string;
  cargoId: number;
  motivoId: number;
  fechaInicio: string;
  fechaFin: string;
}

/** Datos de entrada para crear un código de posición vacante (Regla R1: tipo propio de domain/). */
export interface CrearCargoInput {
  denominacionId: number;
  especificaId: number;
  tipoNominaId: number;
  dependenciaId?: number;
  direccionGeneralId?: number;
  direccionLineaId?: number;
  coordinacionId?: number;
  organismoId?: number;
  gradoId?: number;
  observaciones?: string;
}

export interface CrearCargoEspecialInput {
  cedulaEmpleado: string;
  denominacionId: number;
  especificaId: number;
  tipoNominaId: number;
  dependenciaId?: number;
  direccionGeneralId?: number;
  direccionLineaId?: number;
  coordinacionId?: number;
  organismoId?: number;
  gradoId?: number;
  observaciones?: string;
}

export interface ActualizarCargoInput {
  denominacioncargoid: number;
  denominacioncargoespecificoid: number;
  tiponominaid: number;
  gradoid?: number | null;
  OrganismoAdscritoid?: number | null;
  Dependencia?: number | null;
  DireccionGeneral?: number | null;
  DireccionLinea?: number | null;
  Coordinacion?: number | null;
}

export interface RepoCargos {
  listarCargos(filtros?: {
    dependenciaId?: number;
    tipoNominaId?: number;
    direccionGeneralId?: number;
    direccionLineaId?: number;
    coordinacionId?: number;
    codigo?: string;
    soloVacantes?: boolean;
  }): Promise<CargoAsignacion[]>;
  listarDenominaciones(): Promise<DenominacionCargo[]>;
  listarDenominacionesEspecificas(): Promise<DenominacionCargo[]>;
  asignarCargo(cargoId: number, empleadoCedula: string): Promise<CargoAsignacion>;
  asignarCargoEspecial(input: CrearCargoEspecialInput): Promise<CargoAsignacion>;
  desasignarCargo(cargoId: number): Promise<CargoAsignacion>;
  cambiarCargo(cargoActualId: number, cargoNuevoId: number, motivoId: number): Promise<CargoAsignacion>;
  gestionarEstatus(cargoId: number, estatusId: number, motivoId: number): Promise<CargoAsignacion>;
  listarPrestamos(soloActivos?: boolean, empleado?: string): Promise<PrestamoCargo[]>;
  crearPrestamo(input: CrearPrestamoInput): Promise<PrestamoCargo>;
  finalizarPrestamo(prestamoId: number, fechaFin?: string): Promise<PrestamoCargo>;
  crearDenominacion(input: DenominacionInput): Promise<DenominacionCargo>;
  actualizarDenominacion(id: number, input: DenominacionInput): Promise<DenominacionCargo>;
  eliminarDenominacion(id: number): Promise<void>;
  crearDenominacionEspecifica(input: DenominacionInput): Promise<DenominacionCargo>;
  actualizarDenominacionEspecifica(id: number, input: DenominacionInput): Promise<DenominacionCargo>;
  eliminarDenominacionEspecifica(id: number): Promise<void>;
  listarMotivos(categoria?: string): Promise<CatalogoCargoItem[]>;
  listarEstatus(): Promise<CatalogoCargoItem[]>;
  crearCargo(input: CrearCargoInput): Promise<CargoAsignacion>;
  actualizarCargo(cargoId: number, input: ActualizarCargoInput): Promise<CargoAsignacion>;
  listarTiposNomina(): Promise<CatalogoCargoItem[]>;
  listarGrados(): Promise<CatalogoCargoItem[]>;
  listarOrganismosAdscritos(): Promise<CatalogoCargoItem[]>;
  listarDependencias(): Promise<UnidadOrganizativaCargo[]>;
  listarDireccionesGenerales(dependenciaId?: number): Promise<UnidadOrganizativaCargo[]>;
  listarDireccionesLinea(direccionGeneralId?: number): Promise<UnidadOrganizativaCargo[]>;
  listarCoordinaciones(direccionLineaId?: number): Promise<UnidadOrganizativaCargo[]>;
}
