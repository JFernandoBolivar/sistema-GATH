// Employee data model aligned with Django Employee model

export interface EmployeeEgresado {
  id: number;
  cedulaIdentidad: string;
  nombres: string;
  apellidos: string;
  fechaIngresoOrganismo: Date;
  fechaEgreso: Date;
  motivoEgreso: string;
  ubicacionAdministrativa?: string;
  denominacionCargo?: string;
}

export interface EmployeeFamily {
  id: number;
  empleadoCedula: string;
  nombres: string;
  apellidos: string;
  cedulaIdentidad: string;
  parentescoId: number;
  parentesco?: string;
  sexoId: number;
  sexo?: string;
  fechaNacimiento: Date;
  observaciones?: string;
}

// New interfaces for employee registration and passive employee data
export interface EmployeePassiveData {
  id: number;
  cedulaIdentidad: string;
  nombres: string;
  apellidos: string;
  fechaIngresoOrganismo: Date;
  fechaPasoACondicionalActual?: Date;
  tiempoServicio?: string;
  deudas?: number;
  observacionesInactivo?: string;
}

export interface EmployeeAgregoData {
  id: number;
  empleadoCedula: string;
  fechaAgrego: Date;
  motivoAgrego: string;
  detallesAgrego: string;
  observacionesAgrego?: string;
}

export interface EmployeeRegistrationForm {
  cedulaIdentidad: string;
  nombres: string;
  apellidos: string;
  sexoId: number;
  denominacionCargoId: number;
  denominacionCargoEspecificoId: number;
  ubicacionFisicaId: number;
  ubicacionAdministrativaId: number;
  tipoNominaId: number;
  gradoId: number;
  fechaIngresoOrganismo: Date;
  fechaIngresoAPN?: Date;
  observaciones?: string;
}

export interface EmployeeCodeRegistration {
  codigo: string;
  cedulaIdentidad: string;
  nombres: string;
  apellidos: string;
  estado: string;
  municipio: string;
  parroquia: string;
  direccionDetallada: string;
  numeroContrato: string;
  sexoId: number;
  gradoId: number;
  fechaIngresoOrganismo: Date;
  fechaIngresoAPN?: Date;
  observaciones?: string;
  foto?: string;
}

export interface CargoAssignmentForm {
  empleadoCedula: string;
  denominacionCargoId: number;
  denominacionCargoEspecificoId: number;
  ubicacionFisicaId: number;
  ubicacionAdministrativaId: number;
  gradoId?: number;
  fechaAsignacion: Date;
  motivoAsignacion: string;
}

export interface PayrollChangeForm {
  empleadoCedula: string;
  nuevoTipoNominaId: number;
  tipoCambio: "pasivo" | "agrego" | "activo";
  fechaCambio: Date;
  motivoCambio: string;
  datosPasivo?: Partial<EmployeePassiveData>;
  datosAgrego?: Partial<EmployeeAgregoData>;
}

// Pagination helper
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Filters for employee list
export interface EmployeeFilters {
  search?: string;
  estatusId?: number;
  tipoNominaId?: number;
  ubicacionAdministrativaId?: number;
  denominacionCargoId?: number;
  page?: number;
  pageSize?: number;
}
