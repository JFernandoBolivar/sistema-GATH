import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { validarEnlaceAction } from "@/modules/postulacion/infrastructure/actions/postulacion-actions";
import { ActivarCuentaForm } from "@/modules/postulacion/ui/activar-cuenta-form";
import { EnlaceNoDisponible } from "@/modules/postulacion/ui/enlace-no-disponible";

// La URL lleva el token del enlace: que no viaje en el encabezado Referer a ningún otro sitio.
export const metadata: Metadata = { title: "Crea tu contraseña · Portal del postulante", referrer: "no-referrer" };
export const dynamic = "force-dynamic";

function Verificando() {
  return (
    <div className="mx-auto w-full max-w-md" role="status" aria-live="polite" data-testid="verificando-enlace">
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-lg">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-base text-muted-foreground">Verificando tu enlace…</p>
      </div>
    </div>
  );
}

async function ValidadorEnlace({ token }: { token: string | undefined }) {
  const r = await validarEnlaceAction(token);
  if (!r.ok) return <EnlaceNoDisponible codigo={r.codigo} />;
  return <ActivarCuentaForm token={token as string} numero={r.numero} venceEl={r.venceEl} />;
}

export default async function ActivarPage({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const { t } = await searchParams;
  const token = Array.isArray(t) ? t[0] : t;
  return (
    <Suspense fallback={<Verificando />}>
      <ValidadorEnlace token={token} />
    </Suspense>
  );
}
