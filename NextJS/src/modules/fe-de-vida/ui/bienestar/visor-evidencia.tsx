"use client";

import { useState } from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/components/dialog";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import { useEvidenciaUrl } from "./use-evidencia-url";

/** Foto del pasivo con su cédula, servida por el backend (cada consulta queda auditada). */
export function VisorEvidencia({ solicitudId }: { solicitudId: string }) {
  const [abierta, setAbierta] = useState(false);
  const { estado, reintentar, falloLaImagen } = useEvidenciaUrl(solicitudId);
  const lista = estado.estado === "lista";

  return (
    <section aria-labelledby="fv-foto" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fv-foto" className="text-lg font-semibold">
          Foto con la cédula
        </h2>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => setAbierta(true)}
          disabled={!lista}
        >
          <Maximize2 aria-hidden /> Ver completa
        </Button>
      </div>
      {estado.estado === "cargando" ? (
        <VistaCargando mensaje="Cargando la foto…" onReintentar={reintentar} />
      ) : null}
      {estado.estado === "error" ? <VistaError mensaje={estado.mensaje} onReintentar={reintentar} /> : null}
      {lista ? (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          aria-label="Abrir la foto en pantalla completa"
          className="group relative overflow-hidden rounded-md border focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {/* Object URL local (blob): next/image no aplica. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={estado.url}
            alt="Foto del pasivo sosteniendo su cédula de identidad"
            onError={falloLaImagen}
            className="mx-auto max-h-[40dvh] w-auto max-w-full transition-transform group-hover:scale-[1.01]"
          />
        </button>
      ) : null}

      <Dialog open={abierta} onOpenChange={setAbierta}>
        <DialogContent className="max-w-[min(96vw,1200px)] p-2 sm:p-4">
          <DialogTitle className="sr-only">Foto con la cédula</DialogTitle>
          {estado.estado === "lista" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={estado.url}
              alt="Foto del pasivo sosteniendo su cédula de identidad"
              className="mx-auto max-h-[85dvh] w-auto max-w-full object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
