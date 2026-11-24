/* eslint-disable @next/next/no-img-element */
import { ImageOff } from "lucide-react";
import type { FotoExpediente } from "../../domain/expediente";
import { formatearFechaHora, formatearTamano } from "../../domain/formato";

/** Foto de carnet del postulante. Se pide al proxy del mismo origen: el token no llega al navegador. */
export function SeccionFotoExpediente({ foto }: { foto: FotoExpediente }) {
  if (!foto.tiene || !foto.url) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
        <ImageOff className="size-10" aria-hidden />
        <p>El postulante todavía no ha subido su foto de carnet.</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:p-5">
      <img src={`${foto.url}?v=${encodeURIComponent(foto.subidaEl ?? "")}`} alt="Foto de carnet del postulante" data-testid="foto-postulante" className="aspect-square w-full max-w-72 rounded-xl border object-cover" />
      <dl className="grid content-start gap-3">
        <div><dt className="text-sm text-muted-foreground">Subida el</dt><dd className="font-medium">{formatearFechaHora(foto.subidaEl)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Tamaño</dt><dd className="font-medium">{formatearTamano(foto.tamano) || "—"}</dd></div>
        <p className="text-sm text-muted-foreground">Verifique que el rostro se vea completo, de frente y con fondo claro antes de dar la conformidad.</p>
      </dl>
    </section>
  );
}
