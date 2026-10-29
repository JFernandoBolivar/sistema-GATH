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

export type DatosViviendaDTO = DatosVivienda;
export type PerfilSaludDTO = PerfilSalud;
export type PerfilFisicoDTO = PerfilFisico;
export type FormacionAcademicaDTO = FormacionAcademica;
export type FormacionComplementariaDTO = FormacionComplementaria;
export type ContactoEmergenciaDTO = ContactoEmergencia;
export type AntecedenteDTO = Antecedente;
export type ContratoDTO = Contrato;
export type CargoAsignadoDTO = CargoAsignado;

export interface EncargaduriaDTO {
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

export interface CatalogoEmpleadoDTO {
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
  nacionalidades: CatalogoEmpleadoDTO[];
  parentescos: CatalogoEmpleadoDTO[];
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
  nacionalidadId?: number | null;
  nacionalidadCodigo?: string | null;
  nacionalidadNombre?: string | null;
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
  encargadurias?: EncargaduriaDTO[];
}

export interface GuardarEmpleadoInputDTO {
  cedula: string;
  nombres: string;
  apellidos: string;
  sexoId: number;
  fechaNacimiento: string;
  nacionalidadId?: number | null;
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
