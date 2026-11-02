import {
  Archive,
  CheckCircle2,
  CircleX,
  Clock,
  FileSearch,
  Lock,
  PencilLine,
  Undo2,
  Unlock,
  type LucideIcon,
} from "lucide-react";
import type { TonoEstado } from "@/shared/ui/components/status-badge";
import {
  ESTADOS_PROCESO,
  ESTADOS_SOLICITUD,
  type EstadoProceso,
  type EstadoSolicitud,
} from "../../domain/value-objects/estados";

export interface PresentacionEstado {
  texto: string;
  tono: TonoEstado;
  icono: LucideIcon;
  /** Frase para el pasivo: qué significa y qué sigue. */
  ayuda: string;
}

/** Mapa único estado de la solicitud → texto en español, color e ícono. */
export const PRESENTACION_SOLICITUD: Record<EstadoSolicitud, PresentacionEstado> = {
  BORRADOR: {
    texto: "En borrador",
    tono: "neutral",
    icono: PencilLine,
    ayuda: "Complete sus datos, la foto con su cédula y envíe la fe de vida.",
  },
  PENDIENTE_REVISION: {
    texto: "En revisión",
    tono: "info",
    icono: FileSearch,
    ayuda: "Bienestar Social está revisando su fe de vida.",
  },
  PENDIENTE_SEGUNDO_CHECK: {
    texto: "En segunda revisión",
    tono: "info",
    icono: FileSearch,
    ayuda: "Ya tiene una primera aprobación; falta la confirmación final.",
  },
  VALIDADA: {
    texto: "Validada",
    tono: "success",
    icono: CheckCircle2,
    ayuda: "Su fe de vida fue validada. Ya puede descargar su constancia.",
  },
  RECHAZADA: {
    texto: "Rechazada",
    tono: "danger",
    icono: CircleX,
    ayuda: "Su fe de vida fue rechazada. Comuníquese con Bienestar Social.",
  },
  DEVUELTA: {
    texto: "Devuelta para corrección",
    tono: "warning",
    icono: Undo2,
    ayuda: "Bienestar Social le pide corregir algo. Lea el motivo y reenvíe.",
  },
  EXPIRADA: {
    texto: "Vencida",
    tono: "danger",
    icono: Clock,
    ayuda: "El plazo del proceso terminó sin que se enviara la fe de vida.",
  },
  ARCHIVADA: {
    texto: "Archivada",
    tono: "neutral",
    icono: Archive,
    ayuda: "Solicitud de un proceso anterior.",
  },
};

export const PRESENTACION_PROCESO: Record<EstadoProceso, Omit<PresentacionEstado, "ayuda">> = {
  BORRADOR: { texto: "En preparación", tono: "neutral", icono: PencilLine },
  ABIERTO: { texto: "Abierto", tono: "success", icono: Unlock },
  CERRADO: { texto: "Cerrado", tono: "danger", icono: Lock },
};

export const OPCIONES_ESTADO_SOLICITUD = [
  { valor: "", texto: "Todos los estados" },
  ...ESTADOS_SOLICITUD.map((e) => ({ valor: e, texto: PRESENTACION_SOLICITUD[e].texto })),
];

export const OPCIONES_ESTADO_PROCESO = [
  { valor: "", texto: "Todos los estados" },
  ...ESTADOS_PROCESO.map((e) => ({ valor: e, texto: PRESENTACION_PROCESO[e].texto })),
];
