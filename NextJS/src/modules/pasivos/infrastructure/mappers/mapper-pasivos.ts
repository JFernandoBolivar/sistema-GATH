/**
 * Mappers para convertir datos de Pasivos a entidades de dominio. Mismo
 * patrón que `modules/personal/infrastructure/mappers/mapper-personal.ts`
 * (contrato de expediente compartido `expediente_lectura` del backend).
 */
import type {
  AntecedentePasivo,
  CargoHistorialPasivo,
  CatalogoPasivo,
  ContactoEmergenciaPasivo,
  ContratoActualPasivo,
  DatosViviendaPasivo,
  FormacionAcademicaPasivo,
  Pasivo,
  PerfilFisicoPasivo,
  PerfilSaludPasivo,
} from "../../domain/entities/pasivo";
import type { CatalogosExpedientePasivo } from "../../domain/ports/catalogos-expediente";
import type { CatalogoPasivoApiItem, PasivoApiItem } from "../http/pasivos-api";

function asRec(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

function viviendaApiADto(raw: Record<string, unknown>): DatosViviendaPasivo {
  return {
    estadoId: (raw.estado_id as number | null) ?? null,
    municipioId: (raw.municipio_id as number | null) ?? null,
    parroquiaId: (raw.parroquia_id as number | null) ?? null,
    direccionExacta: (raw.direccion_exacta as string | null) ?? null,
    condicionViviendaId: (raw.condicion_vivienda_id as number | null) ?? null,
    codigoPostalId: (raw.codigo_postal_id as number | null) ?? null,
  };
}

function saludApiADto(raw: Record<string, unknown>): PerfilSaludPasivo {
  return {
    grupoSanguineoId: (raw.grupo_sanguineo_id as number | null) ?? null,
    alergias: (raw.alergias as number[]) ?? [],
    patologiasCronicas: (raw.patologias_cronicas as number[]) ?? [],
    discapacidades: (raw.discapacidades as number[]) ?? [],
  };
}

function fisicoApiADto(raw: Record<string, unknown>): PerfilFisicoPasivo {
  return {
    tallaCamisaId: (raw.talla_camisa_id as number | null) ?? null,
    tallaPantalonId: (raw.talla_pantalon_id as number | null) ?? null,
    tallaZapatosId: (raw.talla_zapatos_id as number | null) ?? null,
    tallaChaquetaId: (raw.talla_chaqueta_id as number | null) ?? null,
  };
}

function academicaApiADto(raw: Record<string, unknown>): FormacionAcademicaPasivo {
  return {
    id: raw.id as number | undefined,
    nivelAcademicoId: (raw.nivel_academico_id as number | null) ?? null,
    carreraId: (raw.carrera_id as number | null) ?? null,
    mencionId: (raw.mencion_id as number | null) ?? null,
    institucionId: (raw.institucion_id as number | null) ?? null,
  };
}

function contactoApiADto(raw: Record<string, unknown>): ContactoEmergenciaPasivo {
  return {
    id: raw.id as number | undefined,
    nombres: (raw.nombres as string | undefined) ?? "",
    apellidos: (raw.apellidos as string | undefined) ?? "",
    telefono: (raw.telefono as string | null) ?? null,
    relacionId: (raw.relacion_id as number | null) ?? null,
  };
}

function antecedenteApiADto(raw: Record<string, unknown>): AntecedentePasivo {
  return {
    id: raw.id as number | undefined,
    organismoId: (raw.organismo_id as number | null) ?? null,
    fechaIngreso: (raw.fecha_ingreso as string | null) ?? null,
    fechaEgreso: (raw.fecha_egreso as string | null) ?? null,
  };
}

function contratoApiADto(raw: Record<string, unknown>): ContratoActualPasivo {
  return {
    id: raw.id as number | undefined,
    nContrato: (raw.n_contrato as string | undefined) ?? null,
    fechaCulminacion: (raw.fecha_culminacion as string | null) ?? null,
    politicaId: (raw.politica_id as number | null) ?? null,
    estatusId: (raw.estatus_id as number | null) ?? null,
    esFijo: raw.es_fijo as boolean | undefined,
  };
}

function cargoHistorialApiADto(raw: Record<string, unknown>): CargoHistorialPasivo {
  return {
    codigo: raw.codigo as string,
    denominacionCargoId: raw.denominacioncargo_id as number,
    denominacionCargoNombre: raw.denominacioncargo_nombre as string,
    denominacionCargoEspecificoId: raw.denominacioncargoespecifico_id as number,
    denominacionCargoEspecificoNombre: raw.denominacioncargoespecifico_nombre as string,
    gradoId: (raw.grado_id as number | null) ?? null,
    gradoNombre: (raw.grado_nombre as string | null) ?? null,
    tipoNominaId: raw.tipo_nomina_id as number,
    tipoNominaNombre: raw.tipo_nomina_nombre as string,
    tipoPersonalId: raw.tipo_personal_id as number,
    tipoPersonalNombre: raw.tipo_personal_nombre as string,
    dependenciaId: raw.dependencia_id as number,
    dependenciaNombre: raw.dependencia_nombre as string,
    direccionGeneralId: (raw.direccion_general_id as number | null) ?? null,
    direccionGeneralNombre: (raw.direccion_general_nombre as string | null) ?? null,
    direccionLineaId: (raw.direccion_linea_id as number | null) ?? null,
    direccionLineaNombre: (raw.direccion_linea_nombre as string | null) ?? null,
    coordinacionId: (raw.coordinacion_id as number | null) ?? null,
    coordinacionNombre: (raw.coordinacion_nombre as string | null) ?? null,
    organismoAdscritoId: (raw.organismo_adscrito_id as number | null) ?? null,
    organismoAdscritoNombre: (raw.organismo_adscrito_nombre as string | null) ?? null,
  };
}

export function pasivoApiAEntidad(raw: PasivoApiItem): Pasivo {
  return {
    id: raw.id,
    cedula: raw.cedula,
    nombres: raw.nombres,
    apellidos: raw.apellidos,
    nombreCompleto: raw.nombre_completo,
    tipoPasivo: raw.tipo_pasivo,
    fechaEgreso: raw.fecha_egreso,
    resolucion: raw.resolucion,
    observaciones: raw.observaciones,
    datosVivienda: raw.datos_vivienda ? viviendaApiADto(asRec(raw.datos_vivienda)) : null,
    perfilSalud: raw.perfil_salud ? saludApiADto(asRec(raw.perfil_salud)) : null,
    perfilFisico: raw.perfil_fisico ? fisicoApiADto(asRec(raw.perfil_fisico)) : null,
    formacionAcademica: (raw.formacion_academica ?? []).map((i) => academicaApiADto(asRec(i))),
    contactoEmergencia: (raw.contacto_emergencia ?? []).map((i) => contactoApiADto(asRec(i))),
    antecedentes: (raw.antecedentes ?? []).map((i) => antecedenteApiADto(asRec(i))),
    contratoActual: raw.contrato_actual ? contratoApiADto(asRec(raw.contrato_actual)) : null,
    cargosHistorial: (raw.cargos_historial ?? []).map((i) => cargoHistorialApiADto(asRec(i))),
  };
}

export function catalogoPasivoApiAEntidad(raw: CatalogoPasivoApiItem): CatalogoPasivo {
  return { id: raw.id, nombre: raw.nombre };
}

export function catalogosExpedienteApiAEntidad(raw: {
  estados: CatalogoPasivoApiItem[];
  municipios: CatalogoPasivoApiItem[];
  parroquias: CatalogoPasivoApiItem[];
  condicionesVivienda: CatalogoPasivoApiItem[];
  codigosPostales: CatalogoPasivoApiItem[];
  gruposSanguineos: CatalogoPasivoApiItem[];
  alergias: CatalogoPasivoApiItem[];
  patologias: CatalogoPasivoApiItem[];
  discapacidades: CatalogoPasivoApiItem[];
  tallas: CatalogoPasivoApiItem[];
  nivelesAcademicos: CatalogoPasivoApiItem[];
  carreras: CatalogoPasivoApiItem[];
  menciones: CatalogoPasivoApiItem[];
  instituciones: CatalogoPasivoApiItem[];
  politicas: CatalogoPasivoApiItem[];
}): CatalogosExpedientePasivo {
  return {
    estados: raw.estados.map(catalogoPasivoApiAEntidad),
    municipios: raw.municipios.map(catalogoPasivoApiAEntidad),
    parroquias: raw.parroquias.map(catalogoPasivoApiAEntidad),
    condicionesVivienda: raw.condicionesVivienda.map(catalogoPasivoApiAEntidad),
    codigosPostales: raw.codigosPostales.map(catalogoPasivoApiAEntidad),
    gruposSanguineos: raw.gruposSanguineos.map(catalogoPasivoApiAEntidad),
    alergias: raw.alergias.map(catalogoPasivoApiAEntidad),
    patologias: raw.patologias.map(catalogoPasivoApiAEntidad),
    discapacidades: raw.discapacidades.map(catalogoPasivoApiAEntidad),
    tallas: raw.tallas.map(catalogoPasivoApiAEntidad),
    nivelesAcademicos: raw.nivelesAcademicos.map(catalogoPasivoApiAEntidad),
    carreras: raw.carreras.map(catalogoPasivoApiAEntidad),
    menciones: raw.menciones.map(catalogoPasivoApiAEntidad),
    instituciones: raw.instituciones.map(catalogoPasivoApiAEntidad),
    politicas: raw.politicas.map(catalogoPasivoApiAEntidad),
  };
}
