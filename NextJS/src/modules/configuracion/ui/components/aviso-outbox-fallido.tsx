"use client";

/**
 * Aviso discreto en Administración → Configuración cuando el outbox agotó los
 * reintentos de un correo (E3). No cambia el diseño: usa el mismo lenguaje de
 * tarjetas y solo aparece si hay fallidos.
 */
import useSWR from "swr";
import { AlertTriangle } from "lucide-react";

import { contarOutboxFallidosAction } from "../../infrastructure/actions/outbox-actions";

export function AvisoOutboxFallido() {
  const { data } = useSWR("outbox-fallidos", contarOutboxFallidosAction, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
  });

  if (!data || data.total === 0) return null;

  return (
    <div
      role="status"
      className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 md:mx-6"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">
          {data.total} correo{data.total === 1 ? "" : "s"} saliente
          {data.total === 1 ? "" : "s"} con fallo definitivo
        </p>
        <p className="mt-1 break-words text-amber-800">
          Revise la configuración de correo y el detalle en la bitácora. Los
          mensajes pendientes se siguen reintentando automáticamente.
        </p>
      </div>
    </div>
  );
}
