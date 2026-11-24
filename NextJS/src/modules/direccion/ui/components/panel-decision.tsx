"use client";

import { CheckCircle2, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ItemBarraAcciones } from "@/modules/captacion/domain/barra-acciones";
import type { AccionExpediente } from "@/modules/presupuesto/domain/solicitud";
import { panelDecision } from "../../domain/decision";

interface Props {
  acciones: readonly AccionExpediente[];
  ocupado?: boolean;
  onElegir: (item: ItemBarraAcciones) => void;
}

/** Decisión de Dirección General: dos botones grandes construidos SOLO desde `acciones[]` del servidor. */
export function PanelDecision({ acciones, ocupado = false, onElegir }: Props) {
  const { aprobar, rechazar } = panelDecision(acciones);
  if (!aprobar && !rechazar) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="sin-acciones">
        No hay una decisión pendiente para este ingreso con su perfil.
      </p>
    );
  }
  return (
    <div role="group" aria-label="Decisión sobre el ingreso" className="grid gap-3 sm:grid-cols-2">
      {aprobar ? (
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="lg"
            className="h-14 w-full text-base"
            disabled={aprobar.deshabilitada || ocupado}
            title={aprobar.deshabilitada ? aprobar.motivoBloqueo : undefined}
            onClick={() => onElegir(aprobar)}
          >
            {aprobar.deshabilitada ? <Lock aria-hidden /> : <CheckCircle2 aria-hidden />}
            {aprobar.etiqueta}
          </Button>
          {aprobar.deshabilitada ? <span className="text-xs text-muted-foreground">{aprobar.motivoBloqueo}</span> : null}
        </div>
      ) : null}
      {rechazar ? (
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            size="lg"
            variant="destructive"
            className="h-14 w-full text-base"
            disabled={rechazar.deshabilitada || ocupado}
            title={rechazar.deshabilitada ? rechazar.motivoBloqueo : undefined}
            onClick={() => onElegir(rechazar)}
          >
            {rechazar.deshabilitada ? <Lock aria-hidden /> : <XCircle aria-hidden />}
            {rechazar.etiqueta}
          </Button>
          {rechazar.deshabilitada ? <span className="text-xs text-muted-foreground">{rechazar.motivoBloqueo}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
