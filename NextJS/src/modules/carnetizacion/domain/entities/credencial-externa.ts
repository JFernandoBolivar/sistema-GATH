/**
 * Tipos de la credencial externa/temporal (visitas y contratistas, O45-A).
 *
 * Viven en `domain/entities` para que la UI no dependa de `infrastructure/http`.
 */
export interface CredencialExterna {
  id: string;
  tipo_credencial: string;
  nombre: string;
  documento: string;
  correo: string;
  empresa: string;
  contrato: string;
  persona_visitada: string;
  motivo: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  estado: "ACTIVA" | "DEVUELTA" | "ANULADA" | "VENCIDA";
  security_hash: string;
  empleado_cedula: string | null;
  observaciones: string;
  devuelta_en: string | null;
  anulada_en: string | null;
}

export interface CrearCredencialExternaInput {
  tipo_codigo: string;
  nombre: string;
  documento: string;
  motivo: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  correo?: string;
  empresa?: string;
  contrato?: string;
  persona_visitada?: string;
  empleado_cedula?: string | null;
  observaciones?: string;
}

export type GrupoCredencial = "externo" | "temporal";
