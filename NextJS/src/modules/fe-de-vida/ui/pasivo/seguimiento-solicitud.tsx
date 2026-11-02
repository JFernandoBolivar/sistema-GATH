"use client";

import { useTransition } from "react";
import { Download, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LineaTiempo, type HitoLineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import type { SolicitudDTO } from "../../application/dtos/fe-de-vida-dto";
import { motivoDeEstado, requiereFotoNueva } from "../../domain/services/reglas";
import { descargarConstanciaAction } from "../../infrastructure/actions/fe-de-vida-actions";
import { PRESENTACION_SOLICITUD } from "../comun/estado-ui";
import { descargarBase64Pdf, formatearFechaHora } from "../comun/formato";

/** Hitos de la línea de tiempo según el estado actual de la solicitud. */
export function hitosSolicitud(s: SolicitudDTO): HitoLineaTiempo[] {
  const enviada = s.estado !== "BORRADOR" && s.estado !== "EXPIRADA";
  const decidida = s.estado === "VALIDADA" || s.estado === "ARCHIVADA";
  const fallida = s.estado === "RECHAZADA";
  const hitos: HitoLineaTiempo[] = [
    {
      id: "enviada",
      titulo: "Fe de vida enviada",
      fecha: formatearFechaHora(s.fechaEnvio),
      estado: enviada ? "hecho" : "actual",
    },
    {
      id: "revision",
      titulo: s.estado === "PENDIENTE_SEGUNDO_CHECK" ? "Primera aprobación lista" : "Revisión de Bienestar Social",
      estado: !enviada ? "pendiente" : decidida || fallida ? "hecho" : "actual",
    },
  ];
  if (s.estado === "DEVUELTA") {
    hitos.push({ id: "devuelta", titulo: "Devuelta para corrección", estado: "actual" });
  }
  hitos.push({
    id: "resultado",
    titulo: fallida ? "Rechazada" : "Fe de vida validada",
    fecha: decidida ? formatearFechaHora(s.fechaValidacion) : undefined,
    estado: decidida ? "hecho" : fallida ? "fallido" : "pendiente",
  });
  return hitos;
}

interface Props {
  solicitud: SolicitudDTO;
  /** Pasa al formulario para corregir y reenviar. */
  onCorregir?: () => void;
}

/** Estado, línea de tiempo, motivo de devolución o rechazo y descarga de la constancia. */
export function SeguimientoSolicitud({ solicitud, onCorregir }: Props) {
  const [descargando, iniciar] = useTransition();
  const p = PRESENTACION_SOLICITUD[solicitud.estado];
  const motivo = motivoDeEstado(solicitud);

  function descargar() {
    iniciar(async () => {
      const res = await descargarConstanciaAction(solicitud.id);
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      descargarBase64Pdf(res.datos, "constancia-fe-de-vida.pdf");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} />
        <p className="text-base">{p.ayuda}</p>
      </div>

      {motivo ? (
        <section
          aria-labelledby="fv-motivo"
          className="rounded-lg border border-warning/40 bg-warning-soft p-4"
        >
          <h3 id="fv-motivo" className="text-base font-semibold">
            {solicitud.estado === "RECHAZADA" ? "Motivo del rechazo" : "Motivo de la devolución"}
          </h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-base">{motivo}</p>
          {solicitud.estado === "DEVUELTA" && requiereFotoNueva(solicitud) ? (
            <p className="mt-2 text-base font-medium">Debe tomar una foto nueva con su cédula.</p>
          ) : null}
        </section>
      ) : null}

      <LineaTiempo hitos={hitosSolicitud(solicitud)} etiqueta="Avance de su fe de vida" />

      <div className="flex flex-wrap gap-3">
        {solicitud.estado === "DEVUELTA" && onCorregir ? (
          <Button type="button" className="min-h-11" onClick={onCorregir}>
            <Pencil aria-hidden /> Corregir y reenviar
          </Button>
        ) : null}
        {solicitud.estado === "VALIDADA" || solicitud.estado === "ARCHIVADA" ? (
          <Button type="button" className="min-h-11" onClick={descargar} disabled={descargando}>
            <Download aria-hidden /> {descargando ? "Descargando…" : "Descargar constancia"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
