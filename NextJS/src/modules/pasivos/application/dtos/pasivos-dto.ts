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
  Pasivo,
  PerfilFisicoPasivo,
  PerfilSaludPasivo,
} from "../../domain/entities/pasivo";
import type { CatalogosExpedientePasivo } from "../../domain/ports/catalogos-expediente";

export interface CatalogoPasivoDTO {
  id: number;
  nombre: string;
}

export interface DatosViviendaPasivoDTO extends DatosViviendaPasivo {}
export interface PerfilSaludPasivoDTO extends PerfilSaludPasivo {}
export interface PerfilFisicoPasivoDTO extends PerfilFisicoPasivo {}
export interface FormacionAcademicaPasivoDTO extends FormacionAcademicaPasivo {}
export interface ContactoEmergenciaPasivoDTO extends ContactoEmergenciaPasivo {}
export interface AntecedentePasivoDTO extends AntecedentePasivo {}
export interface ContratoActualPasivoDTO extends ContratoActualPasivo {}
export interface CargoHistorialPasivoDTO extends CargoHistorialPasivo {}

export interface CatalogosExpedientePasivoDTO extends CatalogosExpedientePasivo {}

export interface PasivoDTO {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  tipoPasivo: string;
  fechaEgreso: string | null;
  resolucion: string | null;
  observaciones: string | null;
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
