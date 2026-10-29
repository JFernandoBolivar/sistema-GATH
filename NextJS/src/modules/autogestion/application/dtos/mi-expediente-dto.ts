export interface CarnetItem {
  id: number;
  empleado_cedula: string;
  empleado_nombres: string;
  empleado_apellidos: string;
  security_hash: string;
  fecha_emision: string;
  motivo_id: number;
  motivo_nombre: string;
  activo: boolean;
  observaciones?: string | null;
}

export interface MotivoCarnetItem {
  id: number;
  nombre: string;
  descripcion: string;
}

export interface FormacionAcademicaItem {
  id: number;
  nivel_academico_id?: number | null;
  nivel_academico_nombre?: string | null;
  carrera_id?: number | null;
  carrera_nombre?: string | null;
  mencion_id?: number | null;
  mencion_nombre?: string | null;
  institucion_id?: number | null;
  institucion_nombre?: string | null;
}

export interface FormacionComplementariaItem {
  id?: number;
  capacitacion_id?: number | null;
  capacitacion_nombre?: string | null;
  institucion_id?: number | null;
  institucion_nombre?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  dias_completados?: string | null;
  horas_completadas?: string | null;
  procedencia_id?: number | null;
  procedencia_nombre?: string | null;
  grupo_id?: number | null;
  grupo_nombre?: string | null;
}

export interface ContactoEmergenciaItem {
  id: number;
  nombres: string;
  apellidos: string;
  telefono?: string | null;
  relacion_id?: number | null;
  relacion_nombre?: string | null;
}

export interface ContratoItem {
  id: number;
  n_contrato: string;
  fecha_ingreso?: string | null;
  fecha_culminacion?: string | null;
  politica_id?: number | null;
  politica_nombre?: string | null;
  estatus_id?: number | null;
  estatus_nombre?: string | null;
  es_fijo: boolean;
}

export interface AsignacionItem {
  id: number;
  codigo?: string;
  denominacion_cargo?: string;
  denominacion_cargo_especifico?: string;
  tipo_nomina?: string;
  dependencia?: string;
  direccion_general?: string;
  direccion_linea?: string;
  coordinacion?: string;
  grado?: string;
  estatus?: string;
  organismo_adscrito?: string;
  tipo_procedencia?: string;
  cargo_cubierto_encargaduria?: boolean;
}

export interface EncargaduriaItem {
  id: number;
  cargo_encargado_id?: number;
  cargo_encargado_codigo?: string;
  cargo_encargado?: string;
  titular_cedula?: string;
  titular_nombre?: string;
  empleado_cedula?: string;
  empleado_nombre?: string;
  motivo_id?: number;
  motivo_nombre?: string;
  estatus_id?: number;
  estatus_nombre?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
}

export interface AntecedenteItem {
  id: number;
  organismo_id?: number | null;
  organismo_nombre?: string | null;
  fecha_ingreso?: string | null;
  fecha_egreso?: string | null;
}

export interface DatosViviendaDTO {
  estado_id?: number | null;
  estado_nombre?: string | null;
  municipio_id?: number | null;
  municipio_nombre?: string | null;
  parroquia_id?: number | null;
  parroquia_nombre?: string | null;
  direccion_exacta?: string | null;
  condicion_vivienda_id?: number | null;
  condicion_vivienda_nombre?: string | null;
  codigo_postal_id?: number | null;
  codigo_postal_nombre?: string | null;
}

export interface PerfilSaludDTO {
  grupo_sanguineo_id?: number | null;
  grupo_sanguineo_nombre?: string | null;
  alergias?: number[];
  alergias_nombres?: string[];
  patologias_cronicas?: number[];
  patologias_cronicas_nombres?: string[];
  discapacidades?: number[];
  discapacidades_nombres?: string[];
}

export interface PerfilFisicoDTO {
  talla_camisa_id?: number | null;
  talla_camisa_nombre?: string | null;
  talla_pantalon_id?: number | null;
  talla_pantalon_nombre?: string | null;
  talla_zapatos_id?: number | null;
  talla_zapatos_nombre?: string | null;
  talla_chaqueta_id?: number | null;
  talla_chaqueta_nombre?: string | null;
}

/**
 * DTO para la visualización del expediente integral del trabajador en Autogestión.
 * Incluye ficha de empleado completa, lista de cargas familiares registradas y carnetización.
 */
export interface MiExpedienteDTO {
  empleado: {
    id: number;
    cedula: string;
    nombres: string;
    apellidos: string;
    nombre_completo: string;
    sexo_id?: number;
    sexo_nombre?: string;
    correo?: string | null;
    telefono_movil?: string | null;
    telefono_habitacion?: string | null;
    fecha_nacimiento?: string | null;
    estado_civil_id?: number | null;
    estado_civil_nombre?: string | null;
    carnet_patria?: string | null;
    nacionalidad_codigo?: string | null;
    nacionalidad_nombre?: string | null;
    total_anos_apn?: number;
    profile?: string | null;
    foto_url?: string | null;
    datos_vivienda?: DatosViviendaDTO | null;
    perfil_salud?: PerfilSaludDTO | null;
    perfil_fisico?: PerfilFisicoDTO | null;
    formacion_academica?: FormacionAcademicaItem[];
    formacion_complementaria?: FormacionComplementariaItem[];
    contacto_emergencia?: ContactoEmergenciaItem[];
    antecedentes?: AntecedenteItem[];
    contrato_actual?: ContratoItem | null;
    contratos?: ContratoItem[];
    asignaciones?: AsignacionItem[];
    encargadurias?: EncargaduriaItem[];
  };
  familiares: Array<{
    id: number;
    empleado_cedula: string;
    primer_nombre: string;
    segundo_nombre?: string | null;
    primer_apellido: string;
    segundo_apellido?: string | null;
    cedula_familiar?: string | null;
    parentesco_id: number;
    parentesco_nombre: string;
    fecha_nacimiento: string;
    sexo_id: number;
    sexo_nombre: string;
    mismo_ente: boolean;
    heredero: boolean;
    observaciones?: string | null;
    perfil_salud?: Record<string, unknown> | null;
    perfil_fisico?: Record<string, unknown> | null;
    formacion_academica?: Record<string, unknown> | null;
  }>;
  carnet_activo?: CarnetItem | null;
  carnets?: CarnetItem[];
  motivos_carnet?: MotivoCarnetItem[];
  /** Correo alternativo y «¿tiene hijos?» (tabla complementaria, B13); nulos si no se han declarado. */
  datos_complementarios?: {
    correo_alternativo: string | null;
    tiene_hijos: boolean | null;
  } | null;
}
