import Link from "next/link";
import { CheckCircle2, LogOut, PhoneCall } from "lucide-react";
import { RUTA_ACCESO_POSTULANTE } from "../domain/acceso-ruta";

/** Pantalla final tras enviar: la sesión ya se cerró y Captación contactará al postulante. */
export function RecibidoView({ numero }: { numero?: string }) {
  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border bg-card p-6 text-center shadow-lg sm:p-8">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle2 className="size-9" aria-hidden />
      </div>
      <h1 className="text-2xl font-bold text-balance">¡Recibimos tu información!</h1>
      {numero && (
        <p className="mt-2 text-sm text-muted-foreground">
          Postulación N.º <span className="font-mono font-medium text-foreground">{numero}</span>
        </p>
      )}
      <ul className="mt-6 grid gap-4 text-left">
        <li className="flex items-start gap-3">
          <PhoneCall className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span className="text-pretty">Captación revisará tus datos y se pondrá en contacto contigo.</span>
        </li>
        <li className="flex items-start gap-3">
          <LogOut className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span className="text-pretty">
            Por seguridad, tu sesión se cerró. Si Captación necesita algo más, te dará un nuevo acceso.
          </span>
        </li>
      </ul>
      <Link
        href={RUTA_ACCESO_POSTULANTE}
        className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Volver a la pantalla de acceso
      </Link>
    </div>
  );
}
