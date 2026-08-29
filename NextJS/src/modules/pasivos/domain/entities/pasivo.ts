/**
 * Entidad de Dominio de Pasivos (Regla R1).
 *
 * Alineado a `PasivoSerializer` del backend
 * (`apps/pasivos/presentation/serializers/pasivos_serializers.py`). Un pasivo
 * también es un `Employee` (expediente anidado con la misma forma de
 * `apps/personal`): `datos_vivienda`, `perfil_salud`, `formacion_academica`,
 * `contacto_emergencia`, `antecedentes` y `contrato_actual` se pueblan solo en
 * el detalle (`GET /api/v1/pasivos/<cedula>/`).
 */
export interface ExpedientePasivo {
  grupoSanguineoId?: number | null;
  estadoId?: number | null;
  municipioId?: number | null;
  parroquiaId?: number | null;
  direccionExacta?: string | null;
  condicionViviendaId?: number | null;
  codigoPostalId?: number | null;
}

export interface Pasivo {
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
}
