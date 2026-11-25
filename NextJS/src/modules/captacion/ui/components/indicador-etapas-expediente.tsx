"use client";

import { GuiaPasos } from "@/modules/presupuesto/ui/components/guia-pasos";
import type { DetalleExpediente } from "../../domain/expediente";
import { etapasExpediente } from "../../domain/etapas-expediente";

/**
 * Recorrido del expediente en siete etapas. Las etapas de Presupuesto y Dirección General que este ingreso no
 * recorre dentro del sistema se muestran como «fuera del sistema».
 */
export function IndicadorEtapasExpediente({ detalle }: { detalle: DetalleExpediente }) {
  const etapas = etapasExpediente({
    estado: detalle.expediente.estado,
    flujo: detalle.flujo,
    historial: detalle.historial,
    ventana: detalle.expediente.ventana,
  });

  return (
    <section aria-label="Etapas del expediente" data-testid="etapas-expediente" className="flex flex-col gap-2">
      <div>
        <h3 className="text-base font-semibold">Etapas del expediente</h3>
        <p className="text-sm text-muted-foreground">
          Recorrido del ingreso y punto en el que se encuentra. Las etapas atenuadas con borde discontinuo se gestionan
          fuera del sistema.
        </p>
      </div>
      <GuiaPasos
        etiqueta="Etapas del expediente"
        pasos={etapas.map((etapa, i) => ({
          id: etapa.id,
          numero: i + 1,
          titulo: etapa.titulo,
          estado: etapa.estado,
          descripcion: etapa.descripcion,
        }))}
      />
    </section>
  );
}
