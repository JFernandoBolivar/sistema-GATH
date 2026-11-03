/**
 * Mappers para convertir datos de Personal a entidades de dominio.
 */
import type {
  Antecedente,
  CargoAsignado,
  ContactoEmergencia,
  Contrato,
  DatosVivienda,
  Empleado,
  FormacionAcademica,
  FormacionComplementaria,
  PerfilFisico,
  PerfilSalud,
  Encargaduria,
} from "../../domain/entities/empleado";
import type { EmpleadoApiItem } from "../http/personal-api";

function asRec(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

function textoValido(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

function viviendaAPIADto(raw: Record<string, unknown>): DatosVivienda {
  return {
    estadoId: (raw.estado_id as number | null) ?? null,
    estadoNombre: textoValido(raw.estado_nombre),
    municipioId: (raw.municipio_id as number | null) ?? null,
    municipioNombre: textoValido(raw.municipio_nombre),
    parroquiaId: (raw.parroquia_id as number | null) ?? null,
    parroquiaNombre: textoValido(raw.parroquia_nombre),
    direccionExacta: (raw.direccion_exacta as string | null) ?? null,
    condicionViviendaId: (raw.condicion_vivienda_id as number | null) ?? null,
    condicionViviendaNombre: textoValido(raw.condicion_vivienda_nombre),
    codigoPostalId: (raw.codigo_postal_id as number | null) ?? null,
    codigoPostalNombre: textoValido(raw.codigo_postal_nombre),
  };
}

function saludAPIADto(raw: Record<string, unknown>): PerfilSalud {
  return {
    grupoSanguineoId: (raw.grupo_sanguineo_id as number | null) ?? null,
    grupoSanguineoNombre: textoValido(raw.grupo_sanguineo_nombre),
    alergias: (raw.alergias as number[]) ?? [],
    alergiasNombres: (raw.alergias_nombres as string[]) ?? [],
    patologiasCronicas: (raw.patologias_cronicas as number[]) ?? [],
    patologiasCronicasNombres: (raw.patologias_cronicas_nombres as string[]) ?? [],
    discapacidades: (raw.discapacidades as number[]) ?? [],
    discapacidadesNombres: (raw.discapacidades_nombres as string[]) ?? [],
  };
}

function fisicoAPIADto(raw: Record<string, unknown>): PerfilFisico {
  return {
    tallaCamisaId: (raw.talla_camisa_id as number | null) ?? null,
    tallaCamisaNombre: textoValido(raw.talla_camisa_nombre),
    tallaPantalonId: (raw.talla_pantalon_id as number | null) ?? null,
    tallaPantalonNombre: textoValido(raw.talla_pantalon_nombre),
    tallaZapatosId: (raw.talla_zapatos_id as number | null) ?? null,
    tallaZapatosNombre: textoValido(raw.talla_zapatos_nombre),
    tallaChaquetaId: (raw.talla_chaqueta_id as number | null) ?? null,
    tallaChaquetaNombre: textoValido(raw.talla_chaqueta_nombre),
  };
}

function academicoAPIADto(raw: Record<string, unknown>): FormacionAcademica {
  return {
    id: raw.id as number | undefined,
    nivelAcademicoId: (raw.nivel_academico_id as number | null) ?? null,
    nivelAcademicoNombre: textoValido(raw.nivel_academico_nombre),
    carreraId: (raw.carrera_id as number | null) ?? null,
    carreraNombre: textoValido(raw.carrera_nombre),
    mencionId: (raw.mencion_id as number | null) ?? null,
    mencionNombre: textoValido(raw.mencion_nombre),
    institucionId: (raw.institucion_id as number | null) ?? null,
    institucionNombre: textoValido(raw.institucion_nombre),
  };
}

function complementariaAPIADto(raw: Record<string, unknown>): FormacionComplementaria {
  return {
    id: raw.id as number | undefined,
    capacitacionId: (raw.capacitacion_id as number | null) ?? null,
    capacitacionNombre: textoValido(raw.capacitacion_nombre),
    institucionId: (raw.institucion_id as number | null) ?? null,
    institucionNombre: textoValido(raw.institucion_nombre),
    fechaInicio: (raw.fecha_inicio as string | null) ?? null,
    fechaFin: (raw.fecha_fin as string | null) ?? null,
    diasCompletados: (raw.dias_completados as string | null) ?? null,
    horasCompletadas: (raw.horas_completadas as string | null) ?? null,
    procedenciaId: (raw.procedencia_id as number | null) ?? null,
    procedenciaNombre: textoValido(raw.procedencia_nombre),
    grupoId: (raw.grupo_id as number | null) ?? null,
    grupoNombre: textoValido(raw.grupo_nombre),
  };
}

function contactoAPIADto(raw: Record<string, unknown>): ContactoEmergencia {
  return {
    id: raw.id as number | undefined,
    nombres: (raw.nombres as string | undefined) ?? "",
    apellidos: (raw.apellidos as string | undefined) ?? "",
    telefono: (raw.telefono as string | null) ?? null,
    relacionId: (raw.relacion_id as number | null) ?? null,
    relacionNombre: textoValido(raw.relacion_nombre),
  };
}

function antecedenteAPIADto(raw: Record<string, unknown>): Antecedente {
  return {
    id: raw.id as number | undefined,
    organismoId: (raw.organismo_id as number | null) ?? null,
    organismoNombre: textoValido(raw.organismo_nombre),
    fechaIngreso: (raw.fecha_ingreso as string | null) ?? null,
    fechaEgreso: (raw.fecha_egreso as string | null) ?? null,
  };
}

function contratoAPIADto(raw: Record<string, unknown>): Contrato {
  return {
    id: raw.id as number | undefined,
    nContrato: (raw.n_contrato as string | undefined) ?? null,
    fechaIngreso: (raw.fecha_ingreso as string | null) ?? null,
    fechaCulminacion: (raw.fecha_culminacion as string | null) ?? null,
    politicaId: (raw.politica_id as number | null) ?? null,
    politicaNombre: (raw.politica_nombre as string | null) ?? null,
    estatusId: (raw.estatus_id as number | null) ?? null,
    estatusNombre: (raw.estatus_nombre as string | null) ?? null,
    esFijo: raw.es_fijo as boolean | undefined,
  };
}

function cargoAsignadoAPIADto(raw: Record<string, unknown>): CargoAsignado {
  return {
    id: (raw.id as number) ?? 0,
    codigo: (raw.codigo as string) ?? "",
    denominacionCargo: (raw.denominacion_cargo as string) ?? "N/A",
    denominacionCargoEspecifico: (raw.denominacion_cargo_especifico as string) ?? "N/A",
    tipoNomina: (raw.tipo_nomina as string) ?? "N/A",
    dependencia: (raw.dependencia as string) ?? "N/A",
    direccionGeneral: (raw.direccion_general as string) ?? "N/A",
    direccionLinea: (raw.direccion_linea as string) ?? "N/A",
    coordinacion: (raw.coordinacion as string) ?? "N/A",
    grado: (raw.grado as string) ?? "N/A",
    estatus: (raw.estatus as string) ?? "ACTIVO",
    organismoAdscrito: (raw.organismo_adscrito as string) ?? "N/A",
    tipoProcedencia: (raw.tipo_procedencia as string) ?? "N/A",
    cargoCubiertoEncargaduria: !!raw.cargo_cubierto_encargaduria,
  };
}

function encargaduriaAPIADto(raw: Record<string, unknown>): Encargaduria {
  return {
    id: (raw.id as number) ?? 0,
    cargoEncargadoId: (raw.cargo_encargado_id as number | null) ?? null,
    cargoEncargadoCodigo: (raw.cargo_encargado_codigo as string | null) ?? null,
    cargoEncargado: (raw.cargo_encargado as string | null) ?? null,
    cargoInfo: (raw.cargo_info as Encargaduria["cargoInfo"]) ?? null,
    titularCedula: (raw.titular_cedula as string | null) ?? null,
    titularNombre: (raw.titular_nombre as string | null) ?? null,
    empleadoCedula: (raw.empleado_cedula as string | null) ?? null,
    empleadoNombre: (raw.empleado_nombre as string | null) ?? null,
    motivoId: (raw.motivo_id as number | null) ?? null,
    motivoNombre: (raw.motivo_nombre as string | null) ?? null,
    estatusId: (raw.estatus_id as number | null) ?? null,
    estatusNombre: (raw.estatus_nombre as string | null) ?? null,
    fechaInicio: (raw.fecha_inicio as string | null) ?? null,
    fechaFin: (raw.fecha_fin as string | null) ?? null,
  };
}

export function empleadoApiAEntidad(raw: EmpleadoApiItem): Empleado {
  const rec = asRec(raw);
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
    nacionalidadId: raw.nacionalidad_id ?? null,
    nacionalidadCodigo: raw.nacionalidad_codigo ?? null,
    nacionalidadNombre: raw.nacionalidad_nombre ?? null,
    totalAnosApn: raw.total_anos_apn,
    datosVivienda: raw.datos_vivienda ? viviendaAPIADto(asRec(raw.datos_vivienda)) : null,
    perfilSalud: raw.perfil_salud ? saludAPIADto(asRec(raw.perfil_salud)) : null,
    perfilFisico: raw.perfil_fisico ? fisicoAPIADto(asRec(raw.perfil_fisico)) : null,
    formacionAcademica: (raw.formacion_academica ?? []).map((i) => academicoAPIADto(asRec(i))),
    formacionComplementaria: (raw.formacion_complementaria ?? []).map((i) => complementariaAPIADto(asRec(i))),
    contactoEmergencia: (raw.contacto_emergencia ?? []).map((i) => contactoAPIADto(asRec(i))),
    antecedentes: (raw.antecedentes ?? []).map((i) => antecedenteAPIADto(asRec(i))),
    contratoActual: raw.contrato_actual ? contratoAPIADto(asRec(raw.contrato_actual)) : null,
    contratos: Array.isArray(rec.contratos) ? (rec.contratos as unknown[]).map((i) => contratoAPIADto(asRec(i))) : [],
    asignaciones: Array.isArray(rec.asignaciones) ? (rec.asignaciones as unknown[]).map((i) => cargoAsignadoAPIADto(asRec(i))) : [],
    encargadurias: Array.isArray(rec.encargadurias) ? (rec.encargadurias as unknown[]).map((i) => encargaduriaAPIADto(asRec(i))) : [],
  };
}
