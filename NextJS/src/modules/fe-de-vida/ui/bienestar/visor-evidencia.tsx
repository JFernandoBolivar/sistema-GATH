"use client";

import { useState } from "react";
import useSWR from "swr";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import { obtenerUrlEvidenciaAction } from "../../infrastructure/actions/fe-de-vida-actions";

/** Foto del pasivo con su cédula (URL prefirmada de corta vigencia) con zoom. */
export function VisorEvidencia({ solicitudId }: { solicitudId: string }) {
  const [ampliada, setAmpliada] = useState(false);
  // Cada consulta de la foto queda auditada: no se revalida sola ni se comparte entre pestañas.
  const { data, error, isLoading, mutate } = useSWR(
    ["fe-de-vida-evidencia", solicitudId],
    async () => {
      const res = await obtenerUrlEvidenciaAction(solicitudId);
      if (!res.ok) throw new Error(res.mensaje);
      return res.datos;
    },
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 60_000 },
  );

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
          disabled={!data}
        >
          {ampliada ? <ZoomOut aria-hidden /> : <ZoomIn aria-hidden />} {ampliada ? "Reducir" : "Ampliar"}
        </Button>
      </div>
      {isLoading ? <VistaCargando mensaje="Cargando la foto…" onReintentar={() => mutate()} /> : null}
      {error ? (
        <VistaError
          mensaje="No se pudo cargar la foto. Verifique que tiene permiso para verla."
          onReintentar={() => mutate()}
        />
      ) : null}
      {data ? (
        <div className={ampliada ? "max-h-[80vh] overflow-auto rounded-md border" : "overflow-hidden rounded-md border"}>
          {/* URL prefirmada externa: next/image no aplica. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.url}
            alt="Foto del pasivo sosteniendo su cédula de identidad"
            className={ampliada ? "max-w-none w-[1200px]" : "mx-auto max-h-[420px] w-auto max-w-full"}
          />
        </div>
      ) : null}
    </section>
  );
}
