/**
 * Entidades de Dominio de Personal (Regla R1).
 *
 * Alineado a
 * `BACKEND/apps/personal/presentation/serializers/personal_serializers.py::EmpleadoSerializer`
 * y a los serializers de escritura anidados
 * (`empleado_escritura_serializers.py`). El expediente anidado (vivienda,
 * salud, físico, formación académica/complementaria, contacto de emergencia,
 * antecedentes y contrato) vive aquí porque forma parte del motor de dominio
 * de personal y es transversal (un pasivo también es un `Employee`).
 */

export interface DatosVivienda {
  estadoId?: number | null;
  estadoNombre?: string | null;
  municipioId?: number | null;
  municipioNombre?: string | null;
  parroquiaId?: number | null;
  parroquiaNombre?: string | null;
  direccionExacta?: string | null;
  condicionViviendaId?: number | null;
  condicionViviendaNombre?: string | null;
  codigoPostalId?: number | null;
  codigoPostalNombre?: string | null;
}

export interface PerfilSalud {
  grupoSanguineoId?: number | null;
  grupoSanguineoNombre?: string | null;
  alergias?: number[];
  alergiasNombres?: string[];
  patologiasCronicas?: number[];
  patologiasCronicasNombres?: string[];
  discapacidades?: number[];
  discapacidadesNombres?: string[];
}

export interface PerfilFisico {
  tallaCamisaId?: number | null;
  tallaCamisaNombre?: string | null;
  tallaPantalonId?: number | null;
  tallaPantalonNombre?: string | null;
  tallaZapatosId?: number | null;
  tallaZapatosNombre?: string | null;
  tallaChaquetaId?: number | null;
  tallaChaquetaNombre?: string | null;
}

export interface FormacionAcademica {
  id?: number;
  nivelAcademicoId?: number | null;
  nivelAcademicoNombre?: string | null;
  carreraId?: number | null;
  carreraNombre?: string | null;
  mencionId?: number | null;
  mencionNombre?: string | null;
  institucionId?: number | null;
  institucionNombre?: string | null;
}

export interface FormacionComplementaria {
  id?: number;
  capacitacionId?: number | null;
  capacitacionNombre?: string | null;
  institucionId?: number | null;
  institucionNombre?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  diasCompletados?: string | null;
  horasCompletadas?: string | null;
  procedenciaId?: number | null;
  procedenciaNombre?: string | null;
  grupoId?: number | null;
  grupoNombre?: string | null;
}

export interface ContactoEmergencia {
  id?: number;
  nombres?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
  relacionId?: number | null;
  relacionNombre?: string | null;
}

export interface CatalogoExpediente {
  id: number;
  nombre: string;
  codigo?: string | null;
  categoriaId?: number | null;
  categoriaNombre?: string | null;
  tipoPrendaId?: number | null;
  tipoPrendaNombre?: string | null;
  regionId?: number | null;
  regionCodigo?: string | null;
  regionDescripcion?: string | null;
}

export interface Encargaduria {
  id: number;
  cargoEncargadoId?: number | null;
  cargoEncargadoCodigo?: string | null;
  cargoEncargado?: string | null;
  cargoInfo?: {
    codigo?: string;
    denominacioncargo?: { cargo?: string };
    denominacioncargoespecifico?: { cargo?: string };
  } | null;
  titularCedula?: string | null;
  titularNombre?: string | null;
  empleadoCedula?: string | null;
  empleadoNombre?: string | null;
  motivoId?: number | null;
  motivoNombre?: string | null;
  estatusId?: number | null;
  estatusNombre?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
}

export interface Antecedente {
  id?: number;
  organismoId?: number | null;
  organismoNombre?: string | null;
  fechaIngreso?: string | null;
  fechaEgreso?: string | null;
}

export interface Contrato {
  id?: number;
  nContrato?: string | null;
  fechaIngreso?: string | null;
  fechaCulminacion?: string | null;
  politicaId?: number | null;
  politicaNombre?: string | null;
  estatusId?: number | null;
  estatusNombre?: string | null;
  esFijo?: boolean;
}

export interface CargoAsignado {
  id: number;
  codigo: string;
  denominacionCargo: string;
  denominacionCargoEspecifico: string;
  tipoNomina: string;
  dependencia: string;
  direccionGeneral: string;
  direccionLinea: string;
  coordinacion: string;
  grado: string;
  estatus: string;
  organismoAdscrito: string;
  tipoProcedencia: string;
  cargoCubiertoEncargaduria: boolean;
}

export interface Empleado {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  sexoId: number;
  sexoNombre: string;
  correo: string | null;
  telefonoMovil: string | null;
  telefonoHabitacion: string | null;
  fechaNacimiento: string | null;
  estadoCivilId: number | null;
  estadoCivilNombre: string | null;
  carnetPatria: string | null;
  carnetPatriaSerial: string | null;
  nacionalidadId?: number | null;
  nacionalidadCodigo?: string | null;
  nacionalidadNombre?: string | null;
  totalAnosApn: number;
  // Expediente anidado (solo poblado en el detalle, Fase 2.2).
  datosVivienda?: DatosVivienda | null;
  perfilSalud?: PerfilSalud | null;
  perfilFisico?: PerfilFisico | null;
  formacionAcademica?: FormacionAcademica[];
  formacionComplementaria?: FormacionComplementaria[];
  contactoEmergencia?: ContactoEmergencia[];
  antecedentes?: Antecedente[];
  contratoActual?: Contrato | null;
  contratos?: Contrato[];
  asignaciones?: CargoAsignado[];
  encargadurias?: Encargaduria[];
}
