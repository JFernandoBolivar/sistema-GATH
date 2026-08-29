/**
 * Puerto del Repositorio de Familiares (Reglas R1, R4).
 */
import type { DocumentoFamiliar, Familiar } from "../entities/familiar";

export interface RepoFamiliares {
  listarPorEmpleado(cedula: string): Promise<Familiar[]>;
  obtenerPorId(id: number): Promise<Familiar>;
  crearFamiliar(data: Omit<Familiar, "id" | "parentescoNombre" | "sexoNombre">): Promise<Familiar>;
  actualizarFamiliar(id: number, data: Partial<Familiar>): Promise<Familiar>;
  eliminarFamiliar(id: number): Promise<void>;
  listarDocumentos(familiarId: number): Promise<DocumentoFamiliar[]>;
}
