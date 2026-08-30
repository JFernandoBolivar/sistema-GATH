/**
 * Puerto del Repositorio de Carnetización (Reglas R1, R4).
 */
import type { Carnet, EstadisticasCarnet, PlantillaCarnet } from "../entities/carnet";

export interface RepoCarnetizacion {
  listarCarnets(cedula?: string): Promise<Carnet[]>;
  emitirCarnet(empleadoCedula: string, motivoId: number, observaciones?: string): Promise<Carnet>;
  validarPorHash(securityHash: string): Promise<{ esValido: boolean; mensaje: string; carnet: Carnet | null }>;
  validarPorId(carnetId: number): Promise<{ esValido: boolean; mensaje: string; carnet: Carnet | null }>;
  listarPlantillas(): Promise<PlantillaCarnet[]>;
  activarPlantilla(plantillaId: number): Promise<PlantillaCarnet>;
  descargarPdf(carnetId: number): Promise<Blob>;
  revocarCarnet(carnetId: number): Promise<Carnet>;
  obtenerEstadisticas(): Promise<EstadisticasCarnet>;
}
