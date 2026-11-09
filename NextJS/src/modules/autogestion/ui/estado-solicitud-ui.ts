import {
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  FileSearch,
  PencilLine,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { TonoEstado } from "@/shared/ui/components/status-badge";
import type { DecisionCambio, EstadoSolicitud } from "../domain/entities/solicitud-actualizacion";

export interface PresentacionEstado {
  texto: string;
  tono: TonoEstado;
  icono: LucideIcon;
  /** Frase para el trabajador: qué significa y qué sigue. */
  ayuda: string;
}

/** Mapa único estado del backend → texto en español, color, ícono (PLAN_REDISENO §6.3-a). */
export const PRESENTACION_ESTADO: Record<EstadoSolicitud, PresentacionEstado> = {
  SOLICITADA: {
    texto: "Solicitada",
    tono: "info",
    icono: Clock,
    ayuda:
      "Bienestar Social revisará su solicitud y habilitará un plazo para que cargue los cambios.",
  },
  HABILITADA: {
    texto: "Habilitada para editar",
    tono: "warning",
    icono: PencilLine,
    ayuda: "Puede cargar sus cambios y soportes y enviarlos antes de que venza el plazo.",
  },
  ENVIADA: {
    texto: "Enviada",
    tono: "info",
    icono: FileSearch,
    ayuda: "Bienestar Social está revisando sus cambios campo por campo.",
  },
  DEVUELTA: {
    texto: "Devuelta para corregir",
    tono: "warning",
    icono: Undo2,
    ayuda:
      "Bienestar Social le devolvió la solicitud con un motivo. Corrija lo indicado y reenvíela dentro del plazo.",
  },
  APROBADA: {
    texto: "Aprobada",
    tono: "success",
    icono: CheckCircle2,
    ayuda: "Todos los cambios fueron aprobados y ya están en su ficha.",
  },
  APROBADA_PARCIAL: {
    texto: "Aprobada en parte",
    tono: "success",
    icono: CircleCheck,
    ayuda: "Se aprobaron algunos campos; los rechazados traen su motivo.",
  },
  RECHAZADA: {
    texto: "Rechazada",
    tono: "danger",
    icono: CircleX,
    ayuda: "La solicitud no fue aprobada. Revise el motivo y, si lo necesita, solicite de nuevo.",
  },
  EXPIRADA: {
    texto: "Vencida",
    tono: "neutral",
    icono: CircleAlert,
    ayuda: "El plazo terminó sin envío. Puede solicitar la actualización de nuevo.",
  },
};

export const PRESENTACION_DECISION: Record<
  DecisionCambio,
  { texto: string; tono: TonoEstado; icono: LucideIcon }
> = {
  PENDIENTE: { texto: "Pendiente", tono: "info", icono: Clock },
  APROBADO: { texto: "Aprobado", tono: "success", icono: CheckCircle2 },
  RECHAZADO: { texto: "Rechazado", tono: "danger", icono: CircleX },
};

/** Opciones del filtro de estado de la bandeja de Bienestar. */
export const OPCIONES_FILTRO_ESTADO: { valor: string; texto: string }[] = [
  { valor: "", texto: "Todos los estados" },
  ...(Object.keys(PRESENTACION_ESTADO) as EstadoSolicitud[]).map((valor) => ({
    valor,
    texto: PRESENTACION_ESTADO[valor].texto,
  })),
];
