"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import { useEvidenciaUrl } from "./use-evidencia-url";

/** Foto del pasivo con su cédula, servida por el backend (cada consulta queda auditada), con zoom. */
export function VisorEvidencia({ solicitudId }: { solicitudId: string }) {
  const [ampliada, setAmpliada] = useState(false);
  const { estado, reintentar, falloLaImagen } = useEvidenciaUrl(solicitudId);

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
          aria-pressed={ampliada}
          onClick={() => setAmpliada((a) => !a)}
          disabled={estado.estado !== "lista"}
        >
          {ampliada ? <ZoomOut aria-hidden /> : <ZoomIn aria-hidden />} {ampliada ? "Reducir" : "Ampliar"}
        </Button>
      </div>
      {estado.estado === "cargando" ? (
        <VistaCargando mensaje="Cargando la foto…" onReintentar={reintentar} />
      ) : null}
      {estado.estado === "error" ? <VistaError mensaje={estado.mensaje} onReintentar={reintentar} /> : null}
      {estado.estado === "lista" ? (
        <div
          className={
            ampliada ? "max-h-[70vh] overflow-auto rounded-md border" : "overflow-hidden rounded-md border"
          }
        >
          {/* Object URL local (blob): next/image no aplica. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={estado.url}
            alt="Foto del pasivo sosteniendo su cédula de identidad"
            onError={falloLaImagen}
            className={ampliada ? "w-[1200px] max-w-none" : "mx-auto max-h-[40dvh] w-auto max-w-full"}
          />
        </div>
      ) : null}
    </section>
  );
}
