export interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

export type AcademyLevel = {
  id: number;
  nivelacademico: string;
};
export type AcademyLevelEmployeeData = {
  nivel_Academico_id: number;
  nivelAcademico: {
    id: number;
    nivelacademico: string;
  } | null;
  institucion: {
    id: number;
    nombre_institucion: string;
  } | null;
  carrera: {
    id: number;
    nombre_carrera: string;
  } | null;
  mencion: {
    id: number;
    nombre_mencion: string;
    carrera: {
      id: number;
      nombre_carrera: string;
    };
  } | null;
  capacitacion?: {
    id: number;
    nombre_capacitacion: string;
  } | null;
};
export interface Municipality {
  id: number;
  municipio: string;
  estadoid: number;
}

export type Cargo = {
  id: number;
  cargo: string;
};

export type Nomina = {
  id: number;
  nomina: string;
  requiere_codig: boolean;
  es_activo: boolean;
};

export type OrganismosAds = {
  id: number;
  Organismoadscrito: string;
};

export type Grado = {
  id: number;
  grado: string;
};

export type Status = {
  id: number;
  estatus: string;
};
export interface States {
  id: number;
  estado: string;
  Region: {
    id: number;
    region: string;
  };
}
export interface TypePerson {
  tipo_personal: string;
  id: number;
}

export interface EmployeeCargoHistory {
  id: string;
  codigo_puesto: string;
  fecha_movimiento: string;
  modificado_por_usuario: string;
  motivo_movimiento: TypeMovement;
  new_denominacioncargo: Cargo | null;
  new_denominacioncargoespecifico: Cargo | null;
  new_grado: Grado | null;
  new_Dependencia: Dependency | null;
  new_DireccionGeneral: DirectionGeneral | null;
  new_DireccionLinea: DirectionLine | null;
  new_Coordinacion: Coordination | null;
  new_estatus: Status | null;
  new_tiponomina: Nomina | null;
  prev_Dependencia: Dependency | null;
  prev_estatus: Status | null;
  prev_denominacioncargo: Cargo | null;
  prev_denominacioncargoespecifico: Cargo | null;
  prev_grado: Grado | null;
  prev_tiponomina: Nomina | null;
  prev_DireccionGeneral: DirectionGeneral | null;
  prev_DireccionLinea: DirectionLine | null;
  prev_Coordinacion: Coordination | null;
}

export interface ErrorFetch {
  status: "Error";
  message: string;
}

export interface ReportTypePerson {
  tipo_personal: string;
  count: number;
}
export interface ReportTypeNomina {
  tiponominaid__nomina: string;
  count: number;
}

export interface BloodGroupType {
  id: number;
  GrupoSanguineo: string;
}

export interface Category {
  id: number;
  nombre_categoria: string;
}
export interface PatologysType {
  id: number;
  patologia: string;
  categoria: Category;
}
export interface DisabilitysType {
  id: number;
  discapacidad: string;
  categoria: Category;
}
export interface allergies {
  id: number;
  alergia: string;
  categoria: Category;
}
export interface ShirtSize {
  id: number;
  talla: string;
}
export interface PantsSize {
  id: number;
  talla: string;
}
export interface ShoesSize {
  id: number;
  talla: number;
}

export interface TallaItem {
  id: number;
  valor: string;
  tipo_prenda: { id: number; categoria: string };
  region: { id: number; codigo: string; descripcion?: string };
}

export interface TipoPrenda {
  id: number;
  categoria: string;
}

export interface RegionTalla {
  id: number;
  codigo: string;
  descripcion?: string;
}

export interface MaritalStatusType {
  id: number;
  estadoCivil: string;
}
export interface ParentType {
  id: number;
  descripcion_parentesco: string;
}

export interface DirectionGeneral {
  id: number;
  Codigo: string;
  direccion_general: string;
}

export interface DirectionLine {
  id: number;
  Codigo: string;
  direccion_linea: string;
}

export interface Coordination {
  id: number;
  Codigo: string;
  coordinacion: string;
}
export interface Dependency {
  id: number;
  Codigo: string;
  dependencia: string;
}

export interface DireccionGeneral {
  id: number;
  direccion_general: string;
  dependencia: {
    id: number;
    Codigo: string;
    dependencia: string;
  };
}
export interface DireccionLinea {
  id: number;
  Codigo: string;
  direccion_linea: string;
}

export interface Municipality {
  id: number;
  municipio: string;
}
export interface DewllingInfo {
  estado: States;
  municipio: Municipality;
  parroquia: Parish;
  direccion_exacta: string;
  codigo_postal: string | null;
  condicion: {
    id: number;
    condicion: string;
  };
}
export interface HealthProfile {
  grupoSanguineo: {
    id: number;
    GrupoSanguineo: string;
  } | null;
  alergias:
    | {
        id: number;
        alergia: string;
        categoria: {
          id: number;
          nombre_categoria: string;
        };
      }[]
    | null;
  discapacidad:
    | {
        id: number;
        discapacidad: string;
        categoria: {
          id: number;
          nombre_categoria: string;
        };
      }[]
    | null;
  patologiasCronicas:
    | {
        id: number;
        patologia: string;
        categoria: {
          id: number;
          nombre_categoria: string;
        };
      }[]
    | null;
}

export interface Background {
  id: number;
  organismo: OrganismosAds | null;
  organismo_id?: number;
  fecha_ingreso: string | null;
  fecha_egreso: string | null;
  fecha_actualizacion: string | null;
  tiempo_servicio: TiempoServicio | null;
}

export interface TiempoServicio {
  years: number;
  months: number;
  days: number;
  total_dias?: number;
}
export interface SupplementaryTraining {
  id: number;
  capacitacion: { id: number; nombre_capacitacion: string } | null;
  institucion: { id: number; nombre_institucion: string } | null;
  procedencia: { id: number; tipo_procedencia: string } | null;
  grupo: { id: number; nombre_grupo: string } | null;
  horas_completadas: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}
export interface PhysicalProfile {
  tallaCamisa: TallaItem | null;
  tallaPantalon: TallaItem | null;
  tallaZapatos: TallaItem | null;
  tallaChaqueta: TallaItem | null;
}
export interface InfoCode {
  id: number;
  codigo: string;
  denominacioncargo: Cargo;
  denominacioncargoespecifico: Cargo;
  grado: Grado;
  tiponomina: Nomina;
  OrganismoAdscrito: OrganismosAds | null;
  Dependencia: Dependency;
  DireccionGeneral: DireccionGeneral | null;
  DireccionLinea: DireccionLinea | null;
  Coordinacion: Coordination | null;
  estatusid: Status;
  tipo_procedencia: TipoProcedencia | null;
  observaciones: string | null;
  fecha_actualizacion: string;
}
export interface Depart {
  id: number;
  nombre_departamento: string;
}
export interface Role {
  id: number;
  nombre_rol: string;
}
export interface UserSystem {
  id: 7;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: null;
  telefono: null;
  departamento: Depart;
  rol: Role;
  is_active: boolean;
  dependencia: Dependency;
  direccion_general: DireccionGeneral | null;
  direccion_linea: DireccionLinea | null;
  coordinacion: Coordination | null;
}
export interface Politica {
  id: number;
  tipo_politica: string;
}

export interface Contrato {
  id: number;
  n_contrato: string;
  fecha_ingreso: string | null;
  fecha_culminacion: string | null;
  fecha_egreso: string | null;
  politica: Politica | null;
  estatus: Status | null;
}

export interface PrestamoCargoData {
  id: number;
  empleado_encargado: string;
  cargo_encargado: number;
  cargo_info: InfoCode;
  motivo: number;
  motivo_nombre: string;
  estatus: number;
  estatus_nombre: string;
  empleado_nombre: string;
  empleado_cedula: string;
  titular_nombre: string;
  titular_cedula: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_creacion: string;
}

export interface MotivoEncargaduria {
  id: number;
  movimiento: string;
}

export interface EmployeeData {
  anos_apn: number;
  total_apn: TiempoServicio;
  id: number;
  cedulaidentidad: string;
  nombres: string;
  apellidos: string;
  profile: string;
  fecha_nacimiento: string;
  contrato: Contrato[] | null;
  sexo: Sex;
  estadoCivil: StatusCivil;
  datos_vivienda: DewllingInfo;
  perfil_salud: HealthProfile;
  perfil_fisico: PhysicalProfile;
  formacion_academica: AcademyLevelEmployeeData[];
  antecedentes: Background[];
  formacion_complementaria: SupplementaryTraining[];
  fecha_actualizacion: string;
  asignaciones: InfoCode[];
  encargadurias: PrestamoCargoData[];
  correo: string | null;
  carnet_patria: string | null;
  telefono_habitacion: string | null;
  telefono_movil: string | null;
}

export interface Sex {
  id: number;
  sexo: string;
}
export interface StatusCivil {
  id: number;
  estadoCivil: string;
}
export interface EmployeeInfo {
  id: number;
  cedulaidentidad: string;
  nombres: string;
  apellidos: string;
  profile: string;
  fecha_nacimiento: string;
  contrato: Contrato[] | null;
  sexo: Sex;
  estadoCivil: StatusCivil;
  datos_vivienda: DewllingInfo;
  perfil_salud: HealthProfile;
  perfil_fisico: PhysicalProfile | null;
  formacion_academica: AcademyLevel;
  antecedentes: Background[];
  formacion_complementaria: SupplementaryTraining[];
  carnet_patria: string | null;
  fecha_actualizacion: string;
}
export interface Code {
  id: number;
  codigo: string;
  denominacioncargo: Cargo;
  denominacioncargoespecifico: Cargo;
  grado: Grado | null;
  tiponomina: Nomina;
  OrganismoAdscrito: OrganismosAds | null;
  Dependencia: Dependency;
  DireccionGeneral: DireccionGeneral;
  DireccionLinea: DireccionLinea | null;
  Coordinacion: Coordination | null;
  estatusid: Status;
  observaciones: string | null;
  fecha_actualizacion: string;
}
export interface ReportStatus {
  estatusid__estatus: string;
  count: number;
}
export interface Carrera {
  id: number;
  nombre_carrera: string;
}

export interface Mencion {
  id: number;
  nombre_mencion: string;
  carrera: Carrera;
}
export interface ConditionDwelling {
  id: number;
  condicion: string;
}
export interface TipoProcedencia {
  id: number;
  tipo_procedencia: string;
}
export interface Parish {
  id: number;
  parroquia: string;
}

export interface Motion {
  id: number;
  movimiento: string;
}

export interface ReportConfig {
  agrupaciones: string[];
  filtros: string[];
}
export interface Dependency {
  id: number;
  Codigo: string;
  dependencia: string;
}

export interface NominaGeneral {
  id: number;
  nomina: string;
  requiere_codig: boolean;
  es_activo: boolean;
}
export interface Region {
  id: number;
  region: string;
}

export interface Family {
  id: number;
  employeecedula: string;
  cedulaFamiliar: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  parentesco: ParentType | null;
  fechanacimiento: string;
  sexo: Sex;
  estadoCivil: StatusCivil | null;
  mismo_ente: boolean;
  heredero: boolean;
  perfil_salud_familiar: HealthProfile | null;
  perfil_fisico_familiar: PhysicalProfile | null;
  formacion_academica_familiar: AcademyLevelEmployeeData;
  observaciones: string;
  createdat: string;
  updatedat: string;
}
export interface TypeMovement {
  id: number;
  movimiento: string;
}
export interface Leaving {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  fechaingresoorganismo: string;
  fecha_egreso: string;
  Tipo_movimiento: TypeMovement;
  cargos: InfoCode[];
}

export interface TipoPregunta {
  id: number;
  nombre: string;
}

export interface Opcion {
  id: number;
  tipo_opcion: string;
}

export interface Pregunta {
  id: number;
  enunciado: string;
  tipo: TipoPregunta;
  opciones: Opcion[];
}
