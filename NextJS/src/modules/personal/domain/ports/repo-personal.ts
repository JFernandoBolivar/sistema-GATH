/**
 * Puerto del Repositorio de Personal (Reglas R1, R4).
 */
import type { Empleado } from "../entities/empleado";

export interface FiltrosListadoEmpleado {
  busqueda?: string;
}

export interface RepoPersonal {
  listarEmpleados(filtros?: FiltrosListadoEmpleado): Promise<Empleado[]>;
  obtenerPorCedula(cedula: string): Promise<Empleado>;
  crearEmpleado(
    data: Omit<Empleado, "id" | "nombreCompleto" | "sexoNombre" | "estadoCivilNombre">
  ): Promise<Empleado>;
  actualizarEmpleado(cedula: string, data: Partial<Empleado>): Promise<Empleado>;
}
