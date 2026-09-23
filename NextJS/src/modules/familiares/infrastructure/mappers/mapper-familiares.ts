/**
 * Mappers para convertir datos de Familiares a entidades de dominio.
 */
import type { DocumentoFamiliar, Familiar } from "../../domain/entities/familiar";
import type { CatalogoFamiliar } from "../../domain/ports/repo-familiares";
import type { CatalogoFamiliarApiItem, DocumentoFamiliarApiItem, FamiliarApiItem } from "../http/familiares-api";

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
    formacionAcademica: raw.formacion_academica
      ? {
          nivelAcademicoId: raw.formacion_academica.nivel_academico_id ?? null,
          carreraId: raw.formacion_academica.carrera_id ?? null,
          mencionId: raw.formacion_academica.mencion_id ?? null,
          institucionId: raw.formacion_academica.institucion_id ?? null,
        }
      : null,
  };
}

export function catalogoFamiliarApiAEntidad(raw: CatalogoFamiliarApiItem): CatalogoFamiliar {
  return {
    id: raw.id,
    nombre: raw.nombre,
    codigo: raw.codigo ?? null,
    categoriaId: raw.categoria_id ?? (raw.categoria?.id ?? null),
    categoriaNombre: raw.categoria_nombre ?? (raw.categoria?.nombre_categoria ?? (raw.categoria?.nombre ?? null)),
    tipoPrendaId: raw.tipo_prenda_id ?? (raw.tipo_prenda?.id ?? null),
    tipoPrendaNombre: raw.tipo_prenda_nombre ?? (raw.tipo_prenda?.categoria ?? null),
    regionId: raw.region_id ?? (raw.region?.id ?? null),
    regionCodigo: raw.region_codigo ?? (raw.region?.codigo ?? null),
    regionDescripcion: raw.region_descripcion ?? (raw.region?.descripcion ?? null),
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
