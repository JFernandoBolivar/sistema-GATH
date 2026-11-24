"use client";

import { useState } from "react";
import { Download, ExternalLink, FileCheck2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatearFechaHora } from "@/modules/captacion/domain/formato";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { describirPuntoCuenta, type PuntoCuenta, type ResultadoAccion } from "../../domain/solicitud";
import { abrirPdf, entregarPdf } from "../descarga";

interface Props {
  puntoCuenta: PuntoCuenta;
  onDescargar: () => Promise<ResultadoAccion<{ base64: string; nombre: string }>>;
  onAviso: (tipo: "exito" | "error", mensaje: string) => void;
  /** Muestra además «Abrir PDF» (otra pestaña), útil para quien decide. */
  conAbrir?: boolean;
}

/** Punto de Cuenta emitido: número, estado con insignia y descarga del PDF. */
export function PuntoCuentaEmitido({ puntoCuenta, onDescargar, onAviso, conAbrir = false }: Props) {
  const [descargando, setDescargando] = useState(false);
  const estado = describirPuntoCuenta(puntoCuenta.estado);

  async function obtener(abrir: boolean) {
    // La ventana se abre en el gesto del usuario; si no, el navegador bloquea la apertura tras la espera.
    const ventana = abrir ? window.open("", "_blank") : null;
    setDescargando(true);
    const r = await onDescargar();
    setDescargando(false);
    if (!r.ok) {
      ventana?.close();
      onAviso("error", r.error);
      return;
    }
    if (abrir) abrirPdf(r.data.base64, ventana);
    else entregarPdf(r.data.base64, r.data.nombre);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="punto-cuenta">
      <div className="flex flex-wrap items-center gap-3">
        <FileCheck2 className="size-6 text-primary" aria-hidden />
        <p className="font-mono text-lg font-bold" data-testid="punto-cuenta-numero">{puntoCuenta.numero}</p>
        <StatusBadge texto={estado.etiqueta} tono={estado.tono} />
      </div>
      <p className="text-sm text-muted-foreground">
        Emitido el {formatearFechaHora(puntoCuenta.emitidoEl)}
        {puntoCuenta.decididoEl ? ` · Decidido el ${formatearFechaHora(puntoCuenta.decididoEl)}` : ""}
      </p>
      {puntoCuenta.tieneDocumento ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="w-full sm:w-fit" onClick={() => void obtener(false)} disabled={descargando}>
            {descargando ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            Descargar PDF
          </Button>
          {conAbrir ? (
            <Button type="button" variant="outline" className="w-full sm:w-fit" onClick={() => void obtener(true)} disabled={descargando}>
              <ExternalLink aria-hidden /> Abrir PDF
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">El documento aún no está disponible.</p>
      )}
    </div>
  );
}
