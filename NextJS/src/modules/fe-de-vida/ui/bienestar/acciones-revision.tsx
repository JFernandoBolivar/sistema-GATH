"use client";

import { useState, useTransition } from "react";
import { CheckCheck, ShieldCheck, Undo2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SolicitudDTO } from "../../application/dtos/fe-de-vida-dto";
import { accionesDisponibles, primerCheck } from "../../domain/services/reglas";
import {
  aprobarDirectoAction,
  devolverSolicitudAction,
  rechazarSolicitudAction,
  registrarCheckAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { useSesionFeDeVida } from "../comun/use-sesion-fe-de-vida";
import { DialogoDevolver, DialogoTexto } from "./dialogos-decision";

type Dialogo = "devolver" | "rechazar" | "aprobar" | null;

interface Props {
  solicitud: SolicitudDTO;
  onHecho: () => void;
}

/** Botones de la revisión: solo aparecen los que el permiso por código y el estado permiten. */
export function AccionesRevision({ solicitud, onHecho }: Props) {
  const { permisos, cedula } = useSesionFeDeVida();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [pendiente, iniciar] = useTransition();
  const acciones = accionesDisponibles(solicitud, permisos, cedula);
  const primero = primerCheck(solicitud);

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

  const hayAcciones = acciones.check || acciones.aprobarDirecto || acciones.devolver || acciones.rechazar;

  return (
    <section aria-labelledby="fv-acciones" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 id="fv-acciones" className="text-lg font-semibold">
        Decisión
      </h2>
      {primero ? (
        <p role="status" className="text-base">
          Primer check dado por la cédula {primero.actorCedula} ({primero.rol.toLowerCase()}).
        </p>
      ) : null}
      {!hayAcciones ? (
        <p className="text-base text-muted-foreground">
          No hay acciones disponibles para usted en este estado.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {acciones.check ? (
            <Button type="button" className="min-h-11" disabled={pendiente} onClick={() => ejecutar(() => registrarCheckAction(solicitud.id))}>
              <CheckCheck aria-hidden /> Dar check
            </Button>
          ) : null}
          {acciones.aprobarDirecto ? (
            <Button type="button" variant="secondary" className="min-h-11" disabled={pendiente} onClick={() => setDialogo("aprobar")}>
              <ShieldCheck aria-hidden /> Aprobación directa
            </Button>
          ) : null}
          {acciones.devolver ? (
            <Button type="button" variant="outline" className="min-h-11" disabled={pendiente} onClick={() => setDialogo("devolver")}>
              <Undo2 aria-hidden /> Devolver para corrección
            </Button>
          ) : null}
          {acciones.rechazar ? (
            <Button type="button" variant="destructive" className="min-h-11" disabled={pendiente} onClick={() => setDialogo("rechazar")}>
              <XCircle aria-hidden /> Rechazar
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
    </section>
  );
}
