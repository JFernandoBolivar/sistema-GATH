import { AlertCircle, CheckCircle2, CircleDashed, Clock, Info, type LucideIcon } from "lucide-react";
import { StatusBadge, type TonoEstado as TonoBadge } from "@/shared/ui/components/status-badge";
import { describirEstado } from "../../domain/expediente";

const ICONO: Record<TonoBadge, LucideIcon> = {
  success: CheckCircle2,
  warning: Clock,
  danger: AlertCircle,
  info: Info,
  neutral: CircleDashed,
};

/** Insignia del estado del expediente: color, ícono y texto en lenguaje claro. */
export function InsigniaEstado({ estado, className }: { estado: string; className?: string }) {
  const { etiqueta, tono } = describirEstado(estado);
  return <StatusBadge texto={etiqueta} tono={tono} icono={ICONO[tono]} className={className} />;
}
