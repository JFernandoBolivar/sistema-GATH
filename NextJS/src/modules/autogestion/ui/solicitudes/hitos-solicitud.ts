import type { HitoLineaTiempo } from "@/shared/ui/components/linea-tiempo";
import type { SolicitudEntity } from "../../domain/entities/solicitud-actualizacion";
import { formatearFechaHora } from "../formato-solicitud";

/**
 * Hitos de la línea de tiempo de una solicitud: Solicitada → Habilitada → Enviada → Resolución.
 * Si la solicitud terminó sin pasar por un hito (rechazo temprano, vencimiento) el hito queda sin completar.
 */
export function hitosSolicitud(s: SolicitudEntity): HitoLineaTiempo[] {
  const habilitada = s.ventanaInicio !== null;
  const enviada = s.fechaEnvio !== null;
  const resuelta =
    s.estado === "APROBADA" || s.estado === "APROBADA_PARCIAL" || s.estado === "RECHAZADA";
  const falloResolucion = s.estado === "RECHAZADA";

  const hitos: HitoLineaTiempo[] = [
    {
      id: "solicitada",
      titulo: "Solicitud registrada",
      fecha: formatearFechaHora(s.fechaSolicitud),
      estado: s.estado === "SOLICITADA" ? "actual" : "hecho",
      detalle:
        s.estado === "SOLICITADA" ? "Esperando que Bienestar Social habilite el plazo." : undefined,
    },
    {
      id: "habilitada",
      titulo: "Plazo habilitado para cargar cambios",
      fecha: habilitada ? formatearFechaHora(s.ventanaInicio) : null,
      estado:
        s.estado === "HABILITADA"
          ? "actual"
          : habilitada
            ? "hecho"
            : s.estado === "SOLICITADA"
              ? "pendiente"
              : "fallido",
      detalle:
        s.estado === "EXPIRADA"
          ? `El plazo venció el ${formatearFechaHora(s.ventanaFin)}.`
          : habilitada && s.ventanaFin
            ? `Vence el ${formatearFechaHora(s.ventanaFin)}.`
            : undefined,
    },
    {
      id: "enviada",
      titulo: "Cambios enviados a Bienestar Social",
      fecha: enviada ? formatearFechaHora(s.fechaEnvio) : null,
      estado: s.estado === "ENVIADA" ? "actual" : enviada ? "hecho" : "pendiente",
    },
    {
      id: "resolucion",
      titulo: falloResolucion
        ? "Solicitud rechazada"
        : s.estado === "APROBADA_PARCIAL"
          ? "Aprobada en parte"
          : "Resolución",
      fecha: resuelta ? formatearFechaHora(s.fechaDecision) : null,
      estado: resuelta ? (falloResolucion ? "fallido" : "hecho") : "pendiente",
      detalle: s.motivoDecision || undefined,
    },
  ];

  // Una solicitud rechazada o vencida antes de avanzar no tiene pasos posteriores que esperar.
  if (s.estado === "RECHAZADA" && !habilitada) return [hitos[0], hitos[3]];
  if (s.estado === "EXPIRADA") return hitos.slice(0, 2);
  return hitos;
}
