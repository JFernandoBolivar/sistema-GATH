"use client";

/**
 * Copias de los gráficos solo para el PDF. Se montan fuera de pantalla mientras
 * se exporta, con un ancho lógico menor al de la pantalla, para que Recharts
 * recalcule ejes y etiquetas y el texto se lea impreso. No alteran lo que ve
 * la persona usuaria.
 */
import type { RefObject } from "react";

import type { EstadisticasDTO } from "../../application/dtos/fe-de-vida-dto";
import type { EntradaLeyenda } from "./capturar-grafico";
import {
  datosBarrasEstados,
  datosBarrasTipos,
  datosDonutCobertura,
  type BarraEstado,
  type BarraTipo,
  type DonutCobertura,
} from "./datos-graficos";
import { ANCHOS_EXPORTACION, GraficoDonut, GraficoEstados, GraficoTipos } from "./graficos-estadisticas";
import { COLORES_COBERTURA, SERIES_GRAFICOS } from "./paleta-graficos";

export type NombreGraficoExportacion = "cobertura" | "tipos" | "estados";

export interface RefsGraficosExportacion {
  cobertura: RefObject<HTMLDivElement | null>;
  tipos: RefObject<HTMLDivElement | null>;
  estados: RefObject<HTMLDivElement | null>;
}

export interface DatosGraficosExportacion {
  donut: DonutCobertura[];
  total: number;
  tipos: BarraTipo[];
  estados: BarraEstado[];
}

export function datosGraficosExportacion(estadisticas: EstadisticasDTO): DatosGraficosExportacion {
  return {
    donut: datosDonutCobertura(estadisticas.kpis.respondieron, estadisticas.kpis.faltan),
    total: estadisticas.kpis.total,
    tipos: datosBarrasTipos(estadisticas.porTipo),
    estados: datosBarrasEstados(estadisticas.porEstado),
  };
}

/** Leyendas que la captura dibuja dentro del PNG (con la cifra de cada porción en la dona). */
export function leyendasExportacion(
  datos: DatosGraficosExportacion,
): Record<NombreGraficoExportacion, EntradaLeyenda[]> {
  return {
    cobertura: datos.donut.map((fila, indice) => ({
      nombre: `${fila.name}: ${fila.value}`,
      color: COLORES_COBERTURA[indice % COLORES_COBERTURA.length],
    })),
    tipos: [
      { nombre: "Respondieron", color: SERIES_GRAFICOS[0] },
      { nombre: "Faltan", color: SERIES_GRAFICOS[1] },
    ],
    estados: [],
  };
}

export function GraficosExportacion({
  datos,
  refs,
}: {
  datos: DatosGraficosExportacion;
  refs: RefsGraficosExportacion;
}) {
  return (
    <div
      aria-hidden
      data-testid="graficos-exportacion"
      className="pointer-events-none fixed top-0 -left-[10000px] flex flex-col bg-white"
    >
      <div style={{ width: ANCHOS_EXPORTACION.cobertura }}>
        <GraficoDonut exportacion contenedorRef={refs.cobertura} datos={datos.donut} total={datos.total} />
      </div>
      <div style={{ width: ANCHOS_EXPORTACION.tipos }}>
        <GraficoTipos exportacion contenedorRef={refs.tipos} datos={datos.tipos} />
      </div>
      <div style={{ width: ANCHOS_EXPORTACION.estados }}>
        <GraficoEstados exportacion contenedorRef={refs.estados} datos={datos.estados} />
      </div>
    </div>
  );
}
