/**
 * DTOs de Personal (Regla R5).
 *
 * `GuardarEmpleadoInputDTO` cubre los campos escalares que acepta
 * `EmpleadoCrearSerializer`/`EmpleadoActualizarSerializer`. Los sub-recursos
 * anidados que el backend también admite (vivienda, salud, formación
 * académica, contacto de emergencia, antecedentes, contrato) quedan fuera de
 * este DTO hasta que la Fase 2.2 del plan de reparación diseñe su
 * contraparte de lectura/escritura — hoy no hay ninguna UI que los consuma.
 */
export interface EmpleadoDTO {
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

export interface GuardarEmpleadoInputDTO {
  cedula: string;
  nombres: string;
  apellidos: string;
  sexoId: number;
  fechaNacimiento: string;
  correo?: string | null;
  telefonoMovil?: string | null;
  telefonoHabitacion?: string | null;
  estadoCivilId?: number | null;
  carnetPatria?: string | null;
}
