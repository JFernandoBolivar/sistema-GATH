/**
 * DTOs para la configuración y aplicación masiva del Correo de Acceso (A7).
 */
export type PoliticaFuente = "alternativo" | "institucional" | "correo_ficha";
export type PoliticaFalta = "dejar_sin_cuenta" | "usar_siguiente";

export interface PoliticaCorreoAccesoDTO {
  politica_pasivos: PoliticaFuente;
  politica_activos: PoliticaFuente;
  si_falta_elegido: PoliticaFalta;
  avisar_al_aplicar_masivo: boolean;
}

export interface ItemVistaPreviaDTO {
  cedula: string;
  nombre_completo: string;
  condicion: string;
  correo_actual: string;
  correo_propuesto: string | null;
  cambiara: boolean;
  quedara_sin_cuenta: boolean;
  es_excepcion_manual: boolean;
  motivo_exclusion?: string | null;
}

export interface ResumenVistaPreviaDTO {
  total_evaluados: number;
  cambian: number;
  quedan_igual: number;
  quedan_sin_cuenta: number;
  excepciones_manuales_ignoradas: number;
  items: ItemVistaPreviaDTO[];
}

export interface AplicarPoliticaMasivaRequestDTO {
  grupo: "activos" | "pasivos";
  motivo: string;
  incluir_excepciones?: boolean;
}

export interface ResultadoAplicarMasivoDTO {
  actualizados: number;
  sin_cambio: number;
  sin_cuenta: number;
  /** Correos propuestos que ya usa otra cuenta: se reportan y no rompen el lote. */
  conflictos?: number;
  total: number;
  /** Grupo grande: se encoló en Celery y se procesará en segundo plano. */
  asincrono?: boolean;
  tarea_id?: string;
}
