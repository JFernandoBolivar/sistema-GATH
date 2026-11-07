import { Badge } from "@/components/ui/badge";
import type {
  EstadoCarga,
  EstadoFila,
} from "../domain/entities/carga-masiva";

interface PropsEstadoCarga {
  estado: EstadoCarga;
}

export function BadgeEstadoCarga({ estado }: PropsEstadoCarga) {
  switch (estado) {
    case "ANALIZADA":
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30 font-medium">
          Analizada (sin guardar)
        </Badge>
      );
    case "APLICADA":
      return (
        <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 font-medium">
          Aplicada
        </Badge>
      );
    case "PENDIENTE_APROBACION":
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 font-medium">
          Pendiente de Aprobación
        </Badge>
      );
    case "RECHAZADA":
      return (
        <Badge variant="outline" className="border-rose-500 text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/30 font-medium">
          Rechazada
        </Badge>
      );
    case "REVERTIDA":
      return (
        <Badge variant="outline" className="border-slate-500 text-slate-700 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/30 font-medium">
          Revertida
        </Badge>
      );
    case "ERROR":
      return (
        <Badge variant="destructive" className="font-medium">
          Error en Análisis
        </Badge>
      );
    default:
      return <Badge variant="outline">{estado}</Badge>;
  }
}

interface PropsEstadoFila {
  estado: EstadoFila;
}

export function BadgeEstadoFila({ estado }: PropsEstadoFila) {
  switch (estado) {
    case "NUEVO":
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30 text-xs">
          Nuevo
        </Badge>
      );
    case "ACTUALIZAR":
      return (
        <Badge variant="outline" className="border-cyan-500 text-cyan-700 dark:text-cyan-300 bg-cyan-50/50 dark:bg-cyan-950/30 text-xs">
          Actualizar
        </Badge>
      );
    case "SIN_CAMBIOS":
      return (
        <Badge variant="outline" className="border-slate-300 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 text-xs">
          Sin cambios
        </Badge>
      );
    case "ADVERTENCIA":
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 text-xs">
          Advertencia
        </Badge>
      );
    case "REQUIERE_CONFIRMACION":
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/40 text-xs font-semibold">
          Requiere confirmación
        </Badge>
      );
    case "ERROR":
      return (
        <Badge variant="destructive" className="text-xs">
          Error
        </Badge>
      );
    default:
      return <Badge variant="outline">{estado}</Badge>;
  }
}
