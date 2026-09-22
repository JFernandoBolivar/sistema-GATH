/**
 * DTOs de Personal (Regla R5). La capa `ui/` opera exclusivamente con estas
 * estructuras y nunca usa entidades de dominio.
 *
 * Incluye el expediente anidado (vivienda, salud, físico, formación
 * académica/complementaria, contacto de emergencia, antecedentes y contrato),
 * alineado a `EmpleadoSerializer` (lectura) y a los Write serializers
 * (`empleado_escritura_serializers.py`) del backend.
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
  CargoAsignado,
} from "../../domain/entities/empleado";

export interface DatosViviendaDTO extends DatosVivienda {}
export interface PerfilSaludDTO extends PerfilSalud {}
export interface PerfilFisicoDTO extends PerfilFisico {}
export interface FormacionAcademicaDTO extends FormacionAcademica {}
export interface FormacionComplementariaDTO extends FormacionComplementaria {}
export interface ContactoEmergenciaDTO extends ContactoEmergencia {}
export interface AntecedenteDTO extends Antecedente {}
export interface ContratoDTO extends Contrato {}
export interface CargoAsignadoDTO extends CargoAsignado {}

export interface CatalogoEmpleadoDTO {
  id: number;
  nombre: string;
}

export interface CatalogosExpedienteDTO {
  estados: CatalogoEmpleadoDTO[];
  municipios: CatalogoEmpleadoDTO[];
  parroquias: CatalogoEmpleadoDTO[];
  condicionesVivienda: CatalogoEmpleadoDTO[];
  codigosPostales: CatalogoEmpleadoDTO[];
  gruposSanguineos: CatalogoEmpleadoDTO[];
  nivelesAcademicos: CatalogoEmpleadoDTO[];
  carreras: CatalogoEmpleadoDTO[];
  menciones: CatalogoEmpleadoDTO[];
  instituciones: CatalogoEmpleadoDTO[];
  capacitaciones: CatalogoEmpleadoDTO[];
  gruposCapacitacion: CatalogoEmpleadoDTO[];
  tiposProcedencia: CatalogoEmpleadoDTO[];
  tiposPrenda: CatalogoEmpleadoDTO[];
  tallas: CatalogoEmpleadoDTO[];
  politicas: CatalogoEmpleadoDTO[];
  alergias: CatalogoEmpleadoDTO[];
  patologias: CatalogoEmpleadoDTO[];
  discapacidades: CatalogoEmpleadoDTO[];
  sexos: CatalogoEmpleadoDTO[];
  estadosCiviles: CatalogoEmpleadoDTO[];
  organismos: CatalogoEmpleadoDTO[];
}

export interface EmpleadoDTO {
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
  totalAnosApn: number;
  datosVivienda?: DatosViviendaDTO | null;
  perfilSalud?: PerfilSaludDTO | null;
  perfilFisico?: PerfilFisicoDTO | null;
  formacionAcademica?: FormacionAcademicaDTO[];
  formacionComplementaria?: FormacionComplementariaDTO[];
  contactoEmergencia?: ContactoEmergenciaDTO[];
  antecedentes?: AntecedenteDTO[];
  contratoActual?: ContratoDTO | null;
  contratos?: ContratoDTO[];
  asignaciones?: CargoAsignadoDTO[];
}

export interface GuardarEmpleadoInputDTO {
  cedula: string;
  nombres: string;
  apellidos: string;
  sexoId: number;
  fechaNacimiento: string;
  correo?: string | null;
  telefonoMovil?: string | null;
  telefonoHabitacion?: string | null;
  estadoCivilId?: number | null;
  carnetPatria?: string | null;
  datosVivienda?: DatosViviendaDTO | null;
  perfilSalud?: PerfilSaludDTO | null;
  perfilFisico?: PerfilFisicoDTO | null;
  formacionAcademica?: FormacionAcademicaDTO[];
  formacionComplementaria?: FormacionComplementariaDTO[];
  contactoEmergencia?: ContactoEmergenciaDTO[];
  antecedentes?: AntecedenteDTO[];
  contrato?: ContratoDTO[];
}

export type { Empleado };
