/**
 * Mappers para convertir datos de Carnetización a entidades de dominio.
 */
import type { Carnet, DatosCarnetEmpleado, EstadisticasCarnet, PlantillaCarnet } from "../../domain/entities/carnet";
import type { CarnetApiItem, EmpleadoCarnetApiItem, EstadisticasCarnetApiItem, PlantillaCarnetApiItem } from "../http/carnetizacion-api";

export function carnetApiAEntidad(raw: CarnetApiItem): Carnet {
  return {
    id: raw.id,
    empleadoCedula: raw.empleado_cedula,
    empleadoNombres: raw.empleado_nombres,
    empleadoApellidos: raw.empleado_apellidos,
    securityHash: raw.security_hash,
    fechaEmision: raw.fecha_emision,
    motivoId: raw.motivo_id,
    motivoNombre: raw.motivo_nombre,
    activo: raw.activo,
    observaciones: raw.observaciones,
  };
}

export function plantillaCarnetApiAEntidad(raw: PlantillaCarnetApiItem): PlantillaCarnet {
  return {
    id: raw.id,
    nombre: raw.nombre,
    imagenUrl: raw.imagen_url,
    activo: raw.activo,
    creado: raw.creado,
  };
}

export function estadisticasCarnetApiAEntidad(raw: EstadisticasCarnetApiItem): EstadisticasCarnet {
  return {
    total: raw.total,
    activos: raw.activos,
    revocados: raw.revocados,
    emitidosHoy: raw.emitidos_hoy,
    emitidosMes: raw.emitidos_mes,
    porMotivo: raw.por_motivo.map((m) => ({
      motivoId: m.motivo_id,
      motivo: m.motivo,
      total: m.total,
    })),
  };
}

export function empleadoApiADatosCarnet(raw: EmpleadoCarnetApiItem): DatosCarnetEmpleado {
  const nombres = raw.nombres?.trim() || "";
  const apellidos = raw.apellidos?.trim() || "";
  const nombreCompleto = raw.nombre_completo?.trim() || `${nombres} ${apellidos}`.trim() || raw.cedula;
  return {
    cedula: raw.cedula,
    nombres,
    apellidos,
    nombreCompleto,
    codigo: raw.codigo || raw.codigo_empleado || undefined,
    cargo: raw.cargo || undefined,
    departamento: raw.departamento || undefined,
    fotoUrl: raw.foto_url || null,
  };
}
