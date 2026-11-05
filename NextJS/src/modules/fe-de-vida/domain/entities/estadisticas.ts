import type { EstadoSolicitud } from "../value-objects/estados";

export type CanalFeDeVida = "EN_LINEA" | "PRESENCIAL";

export interface ProcesoResumenEstadistica {
  readonly id: string;
  readonly nombre: string;
  readonly estado: string;
  readonly apertura: string | null;
  readonly cierre: string | null;
}

export interface KpisEstadistica {
  readonly total: number;
  readonly respondieron: number;
  readonly faltan: number;
  readonly validadas: number;
  readonly porcentajeRespondieron: number;
  readonly porcentajeFaltan: number;
  readonly porcentajeValidadas: number;
}

export interface FilaTipoEstadistica {
  readonly tipoNominaId: number | null;
  readonly tipoNomina: string;
  readonly total: number;
  readonly respondieron: number;
  readonly faltan: number;
  readonly validadas: number;
}

export interface FilaEstadoEstadistica {
  readonly estado: EstadoSolicitud;
  readonly total: number;
}

export interface FilaCanalEstadistica {
  readonly canal: string;
  readonly total: number;
}

export interface FilaMatrizEstadistica {
  readonly tipoNominaId: number | null;
  readonly tipoNomina: string;
  readonly estado: EstadoSolicitud;
  readonly total: number;
}

export interface FiltrosAplicadosEstadistica {
  readonly procesoId: string | null;
  readonly tipoNominaId: number | null;
  readonly estado: EstadoSolicitud | null;
  readonly canal: CanalFeDeVida | null;
  readonly desde: string | null;
  readonly hasta: string | null;
}

export interface EstadisticasEntity {
  readonly proceso: ProcesoResumenEstadistica | null;
  readonly procesos: readonly ProcesoResumenEstadistica[];
  readonly tipos: readonly { id: number; nombre: string }[];
  readonly kpis: KpisEstadistica;
  readonly porTipo: readonly FilaTipoEstadistica[];
  readonly porEstado: readonly FilaEstadoEstadistica[];
  readonly porCanal: readonly FilaCanalEstadistica[];
  readonly matriz: readonly FilaMatrizEstadistica[];
  readonly filtros: FiltrosAplicadosEstadistica;
}

export interface PasivoEstadisticaEntity {
  readonly cedula: string;
  readonly nombreCompleto: string;
  readonly tipoNomina: string;
  readonly correo: string;
  readonly telefono: string;
  readonly estado: EstadoSolicitud | "";
  readonly canal: string;
  readonly fechaEnvio: string | null;
}
