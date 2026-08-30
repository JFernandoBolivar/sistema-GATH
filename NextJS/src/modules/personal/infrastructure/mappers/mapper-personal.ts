/**
 * Mappers para convertir datos de Personal a entidades de dominio.
 */
import type {
  Antecedente,
  ContactoEmergencia,
  Contrato,
  DatosVivienda,
  Empleado,
  FormacionAcademica,
  FormacionComplementaria,
  PerfilFisico,
  PerfilSalud,
} from "../../domain/entities/empleado";
import type { EmpleadoApiItem } from "../http/personal-api";

function asRec(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

function viviendaAPIADto(raw: Record<string, unknown>): DatosVivienda {
  return {
    estadoId: (raw.estado_id as number | null) ?? null,
    municipioId: (raw.municipio_id as number | null) ?? null,
    parroquiaId: (raw.parroquia_id as number | null) ?? null,
    direccionExacta: (raw.direccion_exacta as string | null) ?? null,
    condicionViviendaId: (raw.condicion_vivienda_id as number | null) ?? null,
    codigoPostalId: (raw.codigo_postal_id as number | null) ?? null,
  };
}

function saludAPIADto(raw: Record<string, unknown>): PerfilSalud {
  return {
    grupoSanguineoId: (raw.grupo_sanguineo_id as number | null) ?? null,
    alergias: (raw.alergias as number[]) ?? [],
    patologiasCronicas: (raw.patologias_cronicas as number[]) ?? [],
    discapacidades: (raw.discapacidades as number[]) ?? [],
  };
}

function fisicoAPIADto(raw: Record<string, unknown>): PerfilFisico {
  return {
    tallaCamisaId: (raw.talla_camisa_id as number | null) ?? null,
    tallaPantalonId: (raw.talla_pantalon_id as number | null) ?? null,
    tallaZapatosId: (raw.talla_zapatos_id as number | null) ?? null,
    tallaChaquetaId: (raw.talla_chaqueta_id as number | null) ?? null,
  };
}

function academicoAPIADto(raw: Record<string, unknown>): FormacionAcademica {
  return {
    id: raw.id as number | undefined,
    nivelAcademicoId: (raw.nivel_academico_id as number | null) ?? null,
    carreraId: (raw.carrera_id as number | null) ?? null,
    mencionId: (raw.mencion_id as number | null) ?? null,
    institucionId: (raw.institucion_id as number | null) ?? null,
  };
}

function complementariaAPIADto(raw: Record<string, unknown>): FormacionComplementaria {
  return {
    id: raw.id as number | undefined,
    capacitacionId: (raw.capacitacion_id as number | null) ?? null,
    institucionId: (raw.institucion_id as number | null) ?? null,
    fechaInicio: (raw.fecha_inicio as string | null) ?? null,
    fechaFin: (raw.fecha_fin as string | null) ?? null,
    diasCompletados: (raw.dias_completados as string | null) ?? null,
    horasCompletadas: (raw.horas_completadas as string | null) ?? null,
    procedenciaId: (raw.procedencia_id as number | null) ?? null,
    grupoId: (raw.grupo_id as number | null) ?? null,
  };
}

function contactoAPIADto(raw: Record<string, unknown>): ContactoEmergencia {
  return {
    id: raw.id as number | undefined,
    nombres: (raw.nombres as string | undefined) ?? "",
    apellidos: (raw.apellidos as string | undefined) ?? "",
    telefono: (raw.telefono as string | null) ?? null,
    relacionId: (raw.relacion_id as number | null) ?? null,
  };
}

function antecedenteAPIADto(raw: Record<string, unknown>): Antecedente {
  return {
    id: raw.id as number | undefined,
    organismoId: (raw.organismo_id as number | null) ?? null,
    fechaIngreso: (raw.fecha_ingreso as string | null) ?? null,
    fechaEgreso: (raw.fecha_egreso as string | null) ?? null,
  };
}

function contratoAPIADto(raw: Record<string, unknown>): Contrato {
  return {
    id: raw.id as number | undefined,
    nContrato: (raw.n_contrato as string | undefined) ?? null,
    fechaCulminacion: (raw.fecha_culminacion as string | null) ?? null,
    politicaId: (raw.politica_id as number | null) ?? null,
    estatusId: (raw.estatus_id as number | null) ?? null,
    esFijo: raw.es_fijo as boolean | undefined,
  };
}

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
    datosVivienda: raw.datos_vivienda ? viviendaAPIADto(asRec(raw.datos_vivienda)) : null,
    perfilSalud: raw.perfil_salud ? saludAPIADto(asRec(raw.perfil_salud)) : null,
    perfilFisico: raw.perfil_fisico ? fisicoAPIADto(asRec(raw.perfil_fisico)) : null,
    formacionAcademica: (raw.formacion_academica ?? []).map((i) => academicoAPIADto(asRec(i))),
    formacionComplementaria: (raw.formacion_complementaria ?? []).map((i) => complementariaAPIADto(asRec(i))),
    contactoEmergencia: (raw.contacto_emergencia ?? []).map((i) => contactoAPIADto(asRec(i))),
    antecedentes: (raw.antecedentes ?? []).map((i) => antecedenteAPIADto(asRec(i))),
    contratoActual: raw.contrato_actual ? contratoAPIADto(asRec(raw.contrato_actual)) : null,
  };
}
