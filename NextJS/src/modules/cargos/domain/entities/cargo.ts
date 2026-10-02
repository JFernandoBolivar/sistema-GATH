/**
 * Entidades de Dominio de Cargos (Regla R1), alineadas a los DTOs/serializers
 * de `apps.cargos.presentation.serializers.cargos_serializers`.
 */
export interface DenominacionCargo {
  id: number;
  nombre: string;
  orden: number;
}

export interface CargoAsignacion {
  id: number;
  codigo: string;
  empleadoCedula: string | null;
  empleadoNombre?: string | null;
  denominacionId: number;
  denominacionNombre: string;
  especificaId: number;
  especificaNombre: string;
  tipoNominaId: number;
  tipoNominaNombre: string;
  estatusId: number;
  estatusNombre: string;
  dependenciaId: number | null;
  dependenciaNombre: string | null;
  direccionGeneralId: number | null;
  direccionGeneralNombre: string | null;
  direccionLineaId: number | null;
  direccionLineaNombre: string | null;
  coordinacionId: number | null;
  coordinacionNombre: string | null;
  organismoId?: number | null;
  organismoNombre?: string | null;
  gradoId?: number | null;
  gradoNombre?: string | null;
  observaciones: string | null;
  estaVacante: boolean;
  fechaActualizacion?: string | null;
}

export interface PrestamoCargo {
  id: number;
  empleadoEncargadoCedula: string;
  empleadoEncargadoNombre: string;
  cargoEncargadoId: number;
  cargoEncargadoCodigo: string;
  cargoEncargadoDenominacion?: string;
  titularCedula: string | null;
  titularNombre: string | null;
  motivoId: number;
  motivoNombre: string;
  estatusId: number;
  estatusNombre: string;
  fechaInicio: string;
  fechaFin: string;
  ejecutadoPorId: number;
  estaFinalizada: boolean;
}

/** Item genérico de catálogo (motivos de movimiento / estatus / grados / tipos de nómina). */
export interface CatalogoCargoItem {
  id: number;
  nombre: string;
}

/**
 * Unidad organizativa (dependencia / dirección general / línea /
 * coordinación) para la cascada de ubicación en "Crear código", réplica de
 * `DependenciaSerializer`/`DireccionGeneralSerializer`/etc. del backend.
 */
export interface UnidadOrganizativaCargo {
  id: number;
  codigo: string;
  nombre: string;
}
