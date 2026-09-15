/**
 * DTOs de Cargos (Regla R5). La capa `ui/` opera exclusivamente con estas
 * estructuras y nunca usa entidades de dominio.
 */
export interface DenominacionCargoDTO {
  id: number;
  nombre: string;
  orden: number;
}

export interface CargoAsignacionDTO {
  id: number;
  codigo: string;
  empleadoCedula: string | null;
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
  observaciones: string | null;
  estaVacante: boolean;
}

export interface PrestamoCargoDTO {
  id: number;
  empleadoEncargadoCedula: string;
  empleadoEncargadoNombre: string;
  cargoEncargadoId: number;
  cargoEncargadoCodigo: string;
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

/** Item genérico de catálogo para selects (motivos/estatus/grados/tipos de nómina). */
export interface CatalogoCargoItemDTO {
  id: number;
  nombre: string;
}

/** Unidad organizativa (dependencia/dirección general/línea/coordinación) para la cascada de "Crear código". */
export interface UnidadOrganizativaCargoDTO {
  id: number;
  codigo: string;
  nombre: string;
}

export interface CrearCargoInputDTO {
  denominacionId: number;
  especificaId: number;
  tipoNominaId: number;
  dependenciaId?: number;
  direccionGeneralId?: number;
  direccionLineaId?: number;
  coordinacionId?: number;
  organismoId?: number;
  gradoId?: number;
  observaciones?: string;
}

export interface CambiarCargoInputDTO {
  cargoActualId: number;
  cargoNuevoId: number;
  motivoId: number;
}

export interface GestionarEstatusInputDTO {
  cargoId: number;
  estatusId: number;
  motivoId: number;
}

export interface CrearPrestamoInputDTO {
  cedulaEncargado: string;
  cargoId: number;
  motivoId: number;
  fechaInicio: string;
  fechaFin: string;
}

export interface DenominacionInputDTO {
  nombre: string;
  orden: number;
}
