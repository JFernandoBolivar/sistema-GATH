"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { cuentaRegresiva, formatearFechaHora } from "../domain/expediente";

const TONO = {
  tranquilo: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  pronto: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  urgente: "border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100",
  vencida: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

/** Cuenta regresiva amable hacia el vencimiento de la ventana. Se dibuja al montar para no desfasar el servidor. */
export function CuentaRegresiva({ venceEl }: { venceEl: string | null }) {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    const actualizar = () => setAhora(new Date());
    actualizar();
    const t = setInterval(actualizar, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!venceEl) return null;
  const cuenta = ahora ? cuentaRegresiva(venceEl, ahora) : null;
  const limite = formatearFechaHora(venceEl);

  return (
    <section
      aria-label="Plazo para completar tus datos"
      className={cn("flex items-start gap-3 rounded-xl border p-4", cuenta ? TONO[cuenta.urgencia] : "bg-card")}
    >
      <span className="mt-0.5 shrink-0" aria-hidden>
        {cuenta?.vencida ? <CalendarClock className="size-5" /> : <Hourglass className="size-5" />}
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-pretty" role="status">
          {cuenta?.texto ?? "Calculando tu plazo…"}
        </p>
        {limite && <p className="mt-0.5 text-sm opacity-80">Fecha límite: {limite}</p>}
      </div>
    </section>
  );
}
