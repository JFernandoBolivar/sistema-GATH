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
} from "../entities/cargo";
import type { DenominacionInputDTO, CrearPrestamoInputDTO } from "../../application/dtos/cargo-dto";

export interface RepoCargos {
  listarCargos(filtros?: { dependenciaId?: number; soloVacantes?: boolean }): Promise<CargoAsignacion[]>;
  listarDenominaciones(): Promise<DenominacionCargo[]>;
  listarDenominacionesEspecificas(): Promise<DenominacionCargo[]>;
  asignarCargo(cargoId: number, empleadoCedula: string): Promise<CargoAsignacion>;
  desasignarCargo(cargoId: number): Promise<CargoAsignacion>;
  cambiarCargo(cargoActualId: number, cargoNuevoId: number, motivoId: number): Promise<CargoAsignacion>;
  gestionarEstatus(cargoId: number, estatusId: number, motivoId: number): Promise<CargoAsignacion>;
  listarPrestamos(soloActivos?: boolean): Promise<PrestamoCargo[]>;
  crearPrestamo(input: CrearPrestamoInputDTO): Promise<PrestamoCargo>;
  finalizarPrestamo(prestamoId: number): Promise<PrestamoCargo>;
  crearDenominacion(input: DenominacionInputDTO): Promise<DenominacionCargo>;
  actualizarDenominacion(id: number, input: DenominacionInputDTO): Promise<DenominacionCargo>;
  eliminarDenominacion(id: number): Promise<void>;
  crearDenominacionEspecifica(input: DenominacionInputDTO): Promise<DenominacionCargo>;
  actualizarDenominacionEspecifica(id: number, input: DenominacionInputDTO): Promise<DenominacionCargo>;
  eliminarDenominacionEspecifica(id: number): Promise<void>;
  listarMotivos(): Promise<CatalogoCargoItem[]>;
  listarEstatus(): Promise<CatalogoCargoItem[]>;
}
