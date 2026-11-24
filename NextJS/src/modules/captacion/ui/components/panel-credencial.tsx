"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CredencialEmitida } from "../../domain/expediente";
import { formatearFechaHora } from "../../domain/formato";
import { PanelEnlaceEnviado } from "./panel-enlace-enviado";

interface PanelCredencialProps {
  credencial: CredencialEmitida;
  esReingreso?: boolean;
  /** Se llama al confirmar que ya se entregó: el padre debe descartar la credencial de su estado. */
  onEntendido: () => void;
}

/**
 * Credencial del postulante, visible UNA sola vez. Es un componente sin persistencia: la clave vive solo
 * en el estado del padre mientras se muestra y se descarta al confirmar (no se guarda ni se vuelve a pedir).
 */
export function PanelCredencial({ credencial, esReingreso = false, onEntendido }: PanelCredencialProps) {
  const [copiada, setCopiada] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(credencial.claveTemporal);
      setCopiada(true);
      window.setTimeout(() => setCopiada(false), 2500);
    } catch {
      setCopiada(false);
    }
  }

  // Entrega por correo (D-10): no hay contraseña temporal; se confirma el envío del enlace.
  if (credencial.enlace) {
    return <PanelEnlaceEnviado enviadoA={credencial.enlace.enviadoA} venceEl={credencial.enlace.venceEl} onEntendido={onEntendido} />;
  }

  return (
    <section
      aria-label="Credencial del postulante"
      className="flex flex-col gap-4 rounded-xl border-2 border-primary/40 bg-primary/5 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 text-primary">
        <KeyRound className="size-5" aria-hidden />
        <h3 className="text-lg font-semibold">Credencial de acceso</h3>
      </div>

      {esReingreso ? (
        <p className="rounded-md border border-info/40 bg-info-soft px-3 py-2 text-sm font-medium text-info">
          Es un reingreso: esta persona ya había pasado por Captación antes.
        </p>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-sm text-muted-foreground">Usuario (cédula)</dt>
          <dd className="break-all font-mono text-xl font-semibold" data-testid="credencial-usuario">
            {credencial.usuario}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-muted-foreground">Contraseña temporal</dt>
          <dd className="flex items-center gap-2">
            <span className="break-all font-mono text-xl font-semibold tracking-wide" data-testid="credencial-clave">
              {credencial.claveTemporal}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={copiar} aria-label="Copiar contraseña temporal">
              {copiada ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copiada ? "Copiada" : "Copiar"}
            </Button>
          </dd>
        </div>
      </dl>

      {credencial.venceEl ? (
        <p className="text-sm text-muted-foreground">
          Vigente hasta el <strong className="text-foreground">{formatearFechaHora(credencial.venceEl)}</strong>
          {credencial.ventana ? ` (Ventana ${credencial.ventana})` : ""}. El postulante deberá cambiarla en su primer ingreso.
        </p>
      ) : null}

      <div
        role="alert"
        className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-warning"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong>Esta contraseña no se volverá a mostrar.</strong> Entréguela en persona al postulante antes de
          cerrar este panel. Si se pierde, deberá reponer la credencial.
        </p>
      </div>

      <Button type="button" onClick={onEntendido} className="self-end">
        Ya la entregué
      </Button>
    </section>
  );
}
