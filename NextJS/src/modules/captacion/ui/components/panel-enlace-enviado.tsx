"use client";

import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatearFechaHora } from "../../domain/formato";

interface Props {
  enviadoA: string;
  venceEl: string | null;
  onEntendido: () => void;
}

/** Confirmación del envío del enlace de activación: correo enmascarado y vencimiento. No hay nada secreto que mostrar. */
export function PanelEnlaceEnviado({ enviadoA, venceEl, onEntendido }: Props) {
  return (
    <section
      aria-label="Enlace de acceso enviado"
      className="flex flex-col gap-4 rounded-xl border-2 border-primary/40 bg-primary/5 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 text-primary">
        <MailCheck className="size-5" aria-hidden />
        <h3 className="text-lg font-semibold">Enlace enviado</h3>
      </div>
      <p className="text-base" data-testid="enlace-enviado">
        Enlace enviado a <strong className="break-all font-mono">{enviadoA}</strong>
        {venceEl ? (
          <>
            , vence el <strong>{formatearFechaHora(venceEl)}</strong>
          </>
        ) : null}
        .
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>El correo no lleva contraseña: la persona la crea al abrir el enlace, confirmando su cédula.</li>
        <li>El enlace sirve una sola vez. Si no le llega, puede reenviarlo desde el expediente.</li>
      </ul>
      <Button type="button" onClick={onEntendido} className="self-end">
        Entendido
      </Button>
    </section>
  );
}
