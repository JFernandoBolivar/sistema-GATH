/**
 * Puerto del Repositorio de Cargos (Reglas R1, R4).
 */
import type { CargoAsignacion, DenominacionCargo } from "../entities/cargo";

export interface RepoCargos {
  listarCargos(filtros?: { dependenciaId?: number; soloVacantes?: boolean }): Promise<CargoAsignacion[]>;
  listarDenominaciones(): Promise<DenominacionCargo[]>;
  asignarCargo(cargoId: number, empleadoCedula: string): Promise<CargoAsignacion>;
  desasignarCargo(cargoId: number): Promise<CargoAsignacion>;
}
