"use client";

import { useState, useTransition } from "react";
import { CheckCheck, RotateCcw, ShieldCheck, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SolicitudDTO } from "../../application/dtos/fe-de-vida-dto";
import { primerCheck, rolLegible, rolQueFalta } from "../../domain/services/reglas";
import type { AccionRevision } from "../../domain/value-objects/estados";
import {
  aprobarDirectoAction,
  devolverSolicitudAction,
  rechazarSolicitudAction,
  registrarCheckAction,
  retirarCheckAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { formatearFechaHora } from "../comun/formato";
import { DialogoDevolver, DialogoRetirarCheck, DialogoTexto } from "./dialogos-decision";

type Dialogo = "devolver" | "rechazar" | "aprobar" | "retirar" | null;

interface Props {
  solicitud: SolicitudDTO;
  /** Acciones que el servidor permite al usuario actual: aquí solo se pintan, la regla no se duplica. */
  acciones: readonly AccionRevision[];
  onHecho: () => void;
}

/** Mensaje de estado de la sección Decisión según quién dio el primer check. */
export function mensajeEstadoCheck(
  solicitud: SolicitudDTO,
  acciones: readonly AccionRevision[],
): string | null {
  const primero = primerCheck(solicitud);
  if (!primero) return null;
  const fecha = formatearFechaHora(primero.fecha).replace(/\.$/, ""); // «p. m.» ya cierra con punto
  if (acciones.includes("retirar_check")) {
    return `Usted dio el primer check el ${fecha}. Falta el check de ${rolQueFalta(primero.rol)} de Bienestar Social.`;
  }
  return `Primer check dado por ${primero.actorNombre || primero.actorCedula} (${rolLegible(primero.rol)}) el ${fecha}.`;
}

/** Botones de la revisión: solo los que el servidor declara disponibles para quien mira. */
export function AccionesRevision({ solicitud, acciones, onHecho }: Props) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [pendiente, iniciar] = useTransition();
  const tiene = (a: AccionRevision) => acciones.includes(a);
  const mensaje = mensajeEstadoCheck(solicitud, acciones);

  function ejecutar(fn: () => ReturnType<typeof registrarCheckAction>) {
    iniciar(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      toast.success(res.mensaje);
      setDialogo(null);
      onHecho();
    });
  }

  return (
    <section aria-labelledby="fv-acciones" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 id="fv-acciones" className="text-lg font-semibold">
        Decisión
      </h2>
      {mensaje ? (
        <p role="status" className="text-base">
          {mensaje}
        </p>
      ) : null}
      {acciones.length === 0 ? (
        <p className="text-base text-muted-foreground">
          No hay acciones disponibles para usted en este estado.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tiene("dar_check") ? (
            <Button
              type="button"
              className="min-h-11"
              disabled={pendiente}
              onClick={() => ejecutar(() => registrarCheckAction(solicitud.id))}
            >
              <CheckCheck aria-hidden /> Dar check
            </Button>
          ) : null}
          {tiene("aprobar_directo") ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={pendiente}
              onClick={() => setDialogo("aprobar")}
            >
              <ShieldCheck aria-hidden /> Aprobación directa
            </Button>
          ) : null}
          {tiene("devolver") ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pendiente}
              onClick={() => setDialogo("devolver")}
            >
              <Undo2 aria-hidden /> Devolver para corrección
            </Button>
          ) : null}
          {tiene("rechazar") ? (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={pendiente}
              onClick={() => setDialogo("rechazar")}
            >
              <XCircle aria-hidden /> Rechazar
            </Button>
          ) : null}
          {tiene("retirar_check") ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={pendiente}
              onClick={() => setDialogo("retirar")}
            >
              <RotateCcw aria-hidden /> Retirar mi check
            </Button>
          ) : null}
        </div>
      )}

      {dialogo === "devolver" ? (
        <DialogoDevolver
          abierto
          pendiente={pendiente}
          onCerrar={() => setDialogo(null)}
          onConfirmar={(motivo, nueva) => ejecutar(() => devolverSolicitudAction(solicitud.id, motivo, nueva))}
        />
      ) : null}
      {dialogo === "rechazar" ? (
        <DialogoTexto
          abierto
          pendiente={pendiente}
          onCerrar={() => setDialogo(null)}
          titulo="Rechazar fe de vida"
          descripcion="El rechazo es definitivo. El pasivo verá el motivo."
          etiqueta="El motivo"
          textoBoton="Rechazar"
          destructivo
          onConfirmar={(t) => ejecutar(() => rechazarSolicitudAction(solicitud.id, t))}
        />
      ) : null}
      {dialogo === "aprobar" ? (
        <DialogoTexto
          abierto
          pendiente={pendiente}
          onCerrar={() => setDialogo(null)}
          titulo="Aprobación directa"
          descripcion="Valida la fe de vida sin segundo check. Queda registrada con su justificación."
          etiqueta="La justificación"
          textoBoton="Aprobar"
          onConfirmar={(t) => ejecutar(() => aprobarDirectoAction(solicitud.id, t))}
        />
      ) : null}
      {dialogo === "retirar" ? (
        <DialogoRetirarCheck
          abierto
          pendiente={pendiente}
          onCerrar={() => setDialogo(null)}
          onConfirmar={(motivo) => ejecutar(() => retirarCheckAction(solicitud.id, motivo))}
        />
      ) : null}
    </section>
  );
}
