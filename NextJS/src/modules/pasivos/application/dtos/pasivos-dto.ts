/**
 * DTOs de Pasivos (Regla R5).
 */
import type { Pasivo } from "../../domain/entities/pasivo";

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
  datosVivienda: Record<string, unknown> | null;
  perfilSalud: Record<string, unknown> | null;
  formacionAcademica: Record<string, unknown>[];
  contactoEmergencia: Record<string, unknown>[];
  antecedentes: Record<string, unknown>[];
  contratoActual: Record<string, unknown> | null;
  cargosHistorial: Record<string, unknown>[];
}

export type PasivoDTOItem = PasivoDTO;

export type { Pasivo };
