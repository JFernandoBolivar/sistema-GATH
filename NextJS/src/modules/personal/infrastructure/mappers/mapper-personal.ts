/**
 * Mappers para convertir datos de Personal a entidades de dominio.
 */
import type { Empleado } from "../../domain/entities/empleado";
import type { EmpleadoApiItem } from "../http/personal-api";

export function empleadoApiAEntidad(raw: EmpleadoApiItem): Empleado {
  return {
    id: raw.id,
    cedula: raw.cedula,
    nombres: raw.nombres,
    apellidos: raw.apellidos,
    nombreCompleto: raw.nombre_completo,
    sexoId: raw.sexo_id,
    sexoNombre: raw.sexo_nombre,
    correo: raw.correo,
    telefonoMovil: raw.telefono_movil,
    telefonoHabitacion: raw.telefono_habitacion,
    fechaNacimiento: raw.fecha_nacimiento,
    estadoCivilId: raw.estado_civil_id,
    estadoCivilNombre: raw.estado_civil_nombre,
    carnetPatria: raw.carnet_patria,
    totalAnosApn: raw.total_anos_apn,
  };
}
