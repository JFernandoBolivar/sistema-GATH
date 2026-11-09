/**
 * DTOs de Pasivos (Regla R5). La capa `ui/` opera exclusivamente con estas
 * estructuras y nunca usa entidades de dominio.
 */
import type {
  AntecedentePasivo,
  CargoHistorialPasivo,
  ContactoEmergenciaPasivo,
  ContratoActualPasivo,
  DatosViviendaPasivo,
  FormacionAcademicaPasivo,
  PaginaPasivos,
  Pasivo,
  PerfilFisicoPasivo,
  PerfilSaludPasivo,
  ActualizarPasivoInput,
  FiltrosPasivos,
} from "../../domain/entities/pasivo";
import type { CatalogosExpedientePasivo } from "../../domain/ports/catalogos-expediente";

export interface CatalogoPasivoDTO {
  id: number;
  nombre: string;
}

export type DatosViviendaPasivoDTO = DatosViviendaPasivo;
export type PerfilSaludPasivoDTO = PerfilSaludPasivo;
export type PerfilFisicoPasivoDTO = PerfilFisicoPasivo;
export type FormacionAcademicaPasivoDTO = FormacionAcademicaPasivo;
export type ContactoEmergenciaPasivoDTO = ContactoEmergenciaPasivo;
export type AntecedentePasivoDTO = AntecedentePasivo;
export type ContratoActualPasivoDTO = ContratoActualPasivo;
export type CargoHistorialPasivoDTO = CargoHistorialPasivo;

export type CatalogosExpedientePasivoDTO = CatalogosExpedientePasivo;

export interface PasivoDTO {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  tipoPasivo: string;
  tipoNominaId: number | null;
  fechaEgreso: string | null;
  motivoEgresoId?: number | null;
  motivoEgreso?: string | null;
  apnAntecedentes?: { years: number; months: number; days: number } | null;
  apnEnCurso?: { years: number; months: number; days: number } | null;
  apnTotal?: { years: number; months: number; days: number } | null;
  apnIncompleto?: boolean;
  fechaIngresoApn?: string | null;
  resolucion: string | null;
  observaciones: string | null;
  correo: string | null;
  correoAlternativo: string | null;
  telefonoMovil: string | null;
  telefonoHabitacion: string | null;
  carnetPatria: string | null;
  carnetPatriaSerial: string | null;
  fechaNacimiento: string | null;
  sexoNombre: string | null;
  fechaIngresoOrganismo: string | null;
  estadoCivilId: number | null;
  nacionalidadId: number | null;
  datosVivienda: DatosViviendaPasivoDTO | null;
  perfilSalud: PerfilSaludPasivoDTO | null;
  perfilFisico: PerfilFisicoPasivoDTO | null;
  formacionAcademica: FormacionAcademicaPasivoDTO[];
  contactoEmergencia: ContactoEmergenciaPasivoDTO[];
  antecedentes: AntecedentePasivoDTO[];
  contratoActual: ContratoActualPasivoDTO | null;
  cargosHistorial: CargoHistorialPasivoDTO[];
}

export type PasivoDTOItem = PasivoDTO;

export type { Pasivo };

export type PaginaPasivosDTO = PaginaPasivos;
export type FiltrosPasivosDTO = FiltrosPasivos;
export type ActualizarPasivoInputDTO = ActualizarPasivoInput;
export type RegistrarPasivoInputDTO = import("../../domain/entities/pasivo").RegistrarPasivoInput;
