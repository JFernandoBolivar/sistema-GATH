/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ImageOff, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FotoExpediente } from "../../domain/expediente";
import { formatearFechaHora, formatearTamano } from "../../domain/formato";

/** Foto de carnet del postulante. Se pide al proxy del mismo origen: el token no llega al navegador. */
export function SeccionFotoExpediente({ foto }: { foto: FotoExpediente }) {
  const [ampliada, setAmpliada] = useState(false);
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
      <button type="button" onClick={() => setAmpliada(true)} aria-label="Ampliar la foto de carnet" className="group relative w-full max-w-72 cursor-zoom-in rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <img src={`${foto.url}?v=${encodeURIComponent(foto.subidaEl ?? "")}`} alt="Foto de carnet del postulante" data-testid="foto-postulante" className="aspect-square w-full rounded-xl border object-cover" />
        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5 text-white"><ZoomIn className="size-4" aria-hidden /></span>
      </button>
      <Dialog open={ampliada} onOpenChange={setAmpliada}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto de carnet</DialogTitle>
            <DialogDescription>Verifique que el rostro se vea completo, de frente y con fondo claro.</DialogDescription>
          </DialogHeader>
          <img src={`${foto.url}?v=${encodeURIComponent(foto.subidaEl ?? "")}`} alt="Foto de carnet del postulante, ampliada" className="mx-auto max-h-[70dvh] w-auto rounded-lg border object-contain" />
        </DialogContent>
      </Dialog>
      <dl className="grid content-start gap-3">
        <div><dt className="text-sm text-muted-foreground">Subida el</dt><dd className="font-medium">{formatearFechaHora(foto.subidaEl)}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Tamaño</dt><dd className="font-medium">{formatearTamano(foto.tamano) || "—"}</dd></div>
        <p className="text-sm text-muted-foreground">Verifique que el rostro se vea completo, de frente y con fondo claro antes de dar la conformidad.</p>
      </dl>
    </section>
  );
}
