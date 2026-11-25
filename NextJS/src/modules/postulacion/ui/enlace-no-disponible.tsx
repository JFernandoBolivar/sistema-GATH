import Link from "next/link";
import { AlertCircle, Clock, LinkIcon, LogIn, ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RUTA_ACCESO_POSTULANTE } from "../domain/acceso-ruta";
import { mensajeDeEnlace, PEDIR_ENLACE_NUEVO, type CodigoEnlace } from "../domain/errores-enlace";

const ICONO: Partial<Record<CodigoEnlace, typeof AlertCircle>> = {
  ENLACE_VENCIDO: Clock,
  ENLACE_BLOQUEADO: ShieldAlert,
  ENLACE_USADO: LogIn,
  ENLACE_INVALIDO: LinkIcon,
};

/** El enlace ya no sirve: mensaje amable y qué hacer («Pide a Captación un enlace nuevo»). */
export function EnlaceNoDisponible({ codigo }: { codigo: CodigoEnlace }) {
  const { titulo, detalle } = mensajeDeEnlace(codigo);
  const Icono = ICONO[codigo] ?? AlertCircle;
  return (
    <div className="mx-auto w-full max-w-md" data-testid="enlace-no-disponible" data-codigo={codigo}>
      <div className="rounded-2xl border bg-card p-6 text-center shadow-lg sm:p-8">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Icono className="size-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold text-balance">{titulo}</h1>
        <p className="mt-2 text-base text-muted-foreground text-pretty">{detalle}</p>
        <p className="mt-4 text-sm text-muted-foreground text-pretty">{PEDIR_ENLACE_NUEVO}</p>
        <Link
          href={RUTA_ACCESO_POSTULANTE}
          className={cn(buttonVariants({ size: "lg", variant: "outline" }), "mt-6 w-full")}
        >
          Ir al acceso del postulante
        </Link>
      </div>
    </div>
  );
}
