import type {
  FilaEstadoEstadistica,
  FilaMatrizEstadistica,
  FilaTipoEstadistica,
} from "../../domain/entities/estadisticas";
import { ESTADOS_SOLICITUD, type EstadoSolicitud } from "../../domain/value-objects/estados";
import { PRESENTACION_SOLICITUD } from "../comun/estado-ui";

export const ETIQUETA_CANAL: Record<string, string> = {
  EN_LINEA: "En línea",
  PRESENCIAL: "Presencial",
};

export const ETIQUETAS_ESTADO_MATRIZ: Record<EstadoSolicitud, string> = Object.fromEntries(
  ESTADOS_SOLICITUD.map((estado) => [estado, PRESENTACION_SOLICITUD[estado].texto]),
) as Record<EstadoSolicitud, string>;

export interface BarraTipo {
  name: string;
  respondieron: number;
  faltan: number;
}

export interface DonutCobertura {
  name: string;
  value: number;
}

export interface BarraEstado {
  name: string;
  total: number;
}

/** Barras apiladas: respondieron/faltan por tipo de pasivo (el gráfico no calcula, recibe). */
export function datosBarrasTipos(porTipo: readonly FilaTipoEstadistica[]): BarraTipo[] {
  return porTipo.map((fila) => ({
    name: fila.tipoNomina || "Sin tipo",
    respondieron: fila.respondieron,
    faltan: fila.faltan,
  }));
}

/** Dona de cobertura del proceso: respondieron vs. faltan. */
export function datosDonutCobertura(respondieron: number, faltan: number): DonutCobertura[] {
  return [
    { name: "Respondieron", value: Math.max(0, respondieron) },
    { name: "Faltan por responder", value: Math.max(0, faltan) },
  ];
}

/** Barras horizontales por estado (incluye borrador/vencida del enum del dominio). */
export function datosBarrasEstados(porEstado: readonly FilaEstadoEstadistica[]): BarraEstado[] {
  return porEstado.map((fila) => ({
    name: ETIQUETAS_ESTADO_MATRIZ[fila.estado],
    total: fila.total,
  }));
}

export interface FilaMatrizCalculada {
  tipoNominaId: number | null;
  tipoNomina: string;
  total: number;
  celdas: Record<EstadoSolicitud, number>;
}

/** Matriz tipo × estado completa: las casillas sin solicitudes valen 0. */
export function filasMatriz(
  porTipo: readonly FilaTipoEstadistica[],
  matriz: readonly FilaMatrizEstadistica[],
): FilaMatrizCalculada[] {
  const celdas = new Map<string, number>();
  for (const fila of matriz) {
    celdas.set(`${fila.tipoNominaId ?? ""}|${fila.estado}`, fila.total);
  }
  return porTipo.map((tipo) => {
    const valores = Object.fromEntries(
      ESTADOS_SOLICITUD.map((estado) => [
        estado,
        celdas.get(`${tipo.tipoNominaId ?? ""}|${estado}`) ?? 0,
      ]),
    ) as Record<EstadoSolicitud, number>;
    return {
      tipoNominaId: tipo.tipoNominaId,
      tipoNomina: tipo.tipoNomina || "Sin tipo de pasivo",
      total: ESTADOS_SOLICITUD.reduce((suma, estado) => suma + valores[estado], 0),
      celdas: valores,
    };
  });
}

/** Título del detalle de una casilla: «Validada · JUBILADO». */
export function tituloCasilla(estado: EstadoSolicitud, tipoNomina: string | null): string {
  return [ETIQUETAS_ESTADO_MATRIZ[estado], tipoNomina].filter(Boolean).join(" · ");
}

export function estadosConDatos(porEstado: readonly FilaEstadoEstadistica[]): EstadoSolicitud[] {
  return porEstado.map((fila) => fila.estado);
}
