"use client";

import { Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { textoTiempoRestante, tiempoRestante } from "../../domain/services/reglas-solicitud";
import { formatearFechaHora } from "../formato-solicitud";
import { useAhora } from "./use-ahora";

/** Plazo visible de la ventana: fecha límite y cuenta regresiva (se vuelve urgente con menos de 24 h). */
export function VentanaPlazo({
  ventanaFin,
  className,
}: {
  ventanaFin: string | null;
  className?: string;
}) {
  const ahora = useAhora();
  const restante = tiempoRestante(ventanaFin, ahora);
  const urgente = !restante.vencida && restante.totalSegundos < 86_400;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        restante.vencida
          ? "border-danger/40 bg-danger-soft text-danger"
          : urgente
            ? "border-warning/40 bg-warning-soft text-warning"
            : "border-info/40 bg-info-soft text-info",
        className,
      )}
    >
      <Hourglass className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="text-lg font-bold">
          {restante.vencida ? "El plazo venció" : `Le quedan ${textoTiempoRestante(restante)}`}
        </p>
        <p className="text-sm">Fecha límite: {formatearFechaHora(ventanaFin)}</p>
      </div>
    </div>
  );
}
