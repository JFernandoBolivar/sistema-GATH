/**
 * Entidades de Dominio de Personal (Regla R1).
 *
 * Alineado a `BACKEND/apps/personal/presentation/serializers/personal_serializers.py::EmpleadoSerializer`
 * (verificado contra el backend real — Fase 1 del plan de reparación). El
 * módulo `personal` solo conoce datos demográficos/civiles del empleado;
 * cargo, dependencia, tipo de nómina y estatus laboral pertenecen a los
 * módulos `cargos`/`organizacion`/`catalogos` y todavía no se exponen
 * anidados aquí (ver Fase 2.2 del plan de reparación).
 */
export interface Empleado {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  sexoId: number;
  sexoNombre: string;
  correo: string | null;
  telefonoMovil: string | null;
  telefonoHabitacion: string | null;
  fechaNacimiento: string | null;
  estadoCivilId: number | null;
  estadoCivilNombre: string | null;
  carnetPatria: string | null;
  totalAnosApn: number;
}
