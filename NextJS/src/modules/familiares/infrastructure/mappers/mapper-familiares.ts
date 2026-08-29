/**
 * Mappers para convertir datos de Familiares a entidades de dominio.
 */
import type { DocumentoFamiliar, Familiar } from "../../domain/entities/familiar";
import type { DocumentoFamiliarApiItem, FamiliarApiItem } from "../http/familiares-api";

export function familiarApiAEntidad(raw: FamiliarApiItem): Familiar {
  return {
    id: raw.id,
    empleadoCedula: raw.empleado_cedula,
    cedulaFamiliar: raw.cedula_familiar,
    primerNombre: raw.primer_nombre,
    segundoNombre: raw.segundo_nombre,
    primerApellido: raw.primer_apellido,
    segundoApellido: raw.segundo_apellido,
    parentescoId: raw.parentesco_id,
    parentescoNombre: raw.parentesco_nombre,
    fechaNacimiento: raw.fecha_nacimiento,
    sexoId: raw.sexo_id,
    sexoNombre: raw.sexo_nombre,
    mismoEnte: raw.mismo_ente,
    heredero: raw.heredero,
    observaciones: raw.observaciones,
  };
}

export function documentoFamiliarApiAEntidad(raw: DocumentoFamiliarApiItem): DocumentoFamiliar {
  return {
    id: raw.id,
    familiarId: raw.familiar_id,
    tipoDocumento: raw.tipo_documento,
    rutaArchivo: raw.ruta_archivo,
    fechaSubida: raw.fecha_subida,
  };
}
