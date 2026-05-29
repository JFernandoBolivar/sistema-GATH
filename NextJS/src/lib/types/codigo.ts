// Code catalog for positions - each code represents a unique position assignment
export interface CodigoCatalog {
  id: number
  codigo: string
  denominacionCargo: string
  denominacionCargoEspecifico: string
  ubicacionFisica: string
  ubicacionAdministrativa: string
  tipoNomina: string
  estatus: "activo" | "inactivo"
  descripcion?: string
}

export interface CodigoAssignment {
  id: number
  empleadoCodigo: string
  cedulaIdentidad: string
  nombreEmpleado: string
  direccion: string
  numeroContrato: string
  sexoId: number
  gradoId: number
  fechaIngresoOrganismo: Date
  fechaIngresoAPN?: Date
  observaciones?: string
}

export interface CodeMovement {
  id: number
  empleadoCedula: string
  codigoAnterior: string
  codigoNuevo: string
  cargoAnterior: string
  cargoNuevo: string
  ubicacionAnterior: string
  ubicacionNueva: string
  tipoNominaAnterior: string
  tipoNominaNuevo: string
  motivoMovimiento: string
  fechaMovimiento: Date
}

export interface StatusChange {
  id: number
  empleadoCedula: string
  empleadoNombre: string
  codigoAsignado: string
  estatusAnterior: "activo" | "pasivo" | "egresado"
  estatusNuevo: "activo" | "pasivo" | "egresado"
  fechaCambio: Date
  motivoCambio?: string
  numeroResolucion?: string // para pasivo
  motivoEgreso?: string // para egresado
}

export interface EmployeeWithCode {
  codigo: string
  cedulaIdentidad: string
  nombre: string
  apellido: string
  direccion: string
  numeroContrato: string
  denominacionCargo: string
  ubicacionFisica: string
  ubicacionAdministrativa: string
  tipoNomina: string
  estatus: "activo" | "pasivo" | "egresado"
  fechaIngreso: Date
  sexo: string
}
