"use client";

import { StatusBadge } from "@/shared/ui/components/status-badge";
import type { CambioEntity } from "../../domain/entities/solicitud-actualizacion";
import { etiquetaCampo, nombreSeccion } from "../../domain/value-objects/campos-seccion";
import { PRESENTACION_DECISION } from "../estado-solicitud-ui";
import { formatearValor } from "../formato-solicitud";
import { useNombresCatalogo } from "./use-nombres-catalogo";

/** Cambios de la solicitud con su resultado campo por campo (y el motivo si fueron rechazados). */
export function ResumenCambios({
  cambios,
  mostrarDecision,
}: {
  cambios: CambioEntity[];
  mostrarDecision: boolean;
}) {
  const nombres = useNombresCatalogo(cambios);
  if (cambios.length === 0) {
    return <p className="text-base text-muted-foreground">Todavía no hay cambios guardados.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {cambios.map((c) => {
        const d = PRESENTACION_DECISION[c.decision];
        return (
          <li key={c.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-semibold">
                {nombreSeccion(c.seccion)} ·{" "}
                {c.accion === "ELIMINAR"
                  ? "Quitar registro"
                  : c.accion === "CREAR"
                    ? `Nuevo registro${c.entidadDestino ? `: ${etiquetaCampo(c.campo, c.entidadDestino)}` : ""}`
                    : etiquetaCampo(c.campo, c.entidadDestino)}
              </p>
              {mostrarDecision ? (
                <StatusBadge texto={d.texto} tono={d.tono} icono={d.icono} />
              ) : null}
            </div>
            <p className="mt-1 break-words text-base">
              {c.campo === "profile"
                ? "Foto nueva cargada"
                : c.accion === "ELIMINAR"
                  ? `Motivo: ${String((c.valorPropuesto as { motivo?: string } | null)?.motivo ?? "")}`
                  : formatearValor(c.valorPropuesto, c.campo, nombres)}
            </p>
            {c.decision === "RECHAZADO" && c.motivoDecision ? (
              <p className="mt-1 text-sm text-danger">Motivo del rechazo: {c.motivoDecision}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
