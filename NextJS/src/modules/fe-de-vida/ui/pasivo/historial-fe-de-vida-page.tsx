"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { LIMITE_PAGINA } from "../../domain/value-objects/estados";
import { listarMisSolicitudesAction } from "../../infrastructure/actions/fe-de-vida-actions";
import { OPCIONES_ESTADO_SOLICITUD, PRESENTACION_SOLICITUD } from "../comun/estado-ui";
import { formatearFechaHora } from "../comun/formato";
import { PaginacionNav } from "../comun/paginacion-nav";
import { SeguimientoSolicitud } from "./seguimiento-solicitud";

/** Historial de fe de vida del pasivo: una solicitud por proceso, paginado y filtrable por estado. */
export default function HistorialFeDeVidaPage() {
  const [estado, setEstado] = useState("");
  const [offset, setOffset] = useState(0);
  const [limite, setLimite] = useState(LIMITE_PAGINA);
  const { data, error, isLoading, mutate } = useSWR(["fe-de-vida-historial", estado, offset, limite], async () => {
    const res = await listarMisSolicitudesAction({ estado, limit: limite, offset });
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        titulo="Historial de fe de vida"
        descripcion="Sus solicitudes en cada proceso."
        migas={
          <Link href="/autogestion/fe-de-vida" className="inline-flex min-h-11 items-center gap-1 text-primary hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Volver a fe de vida
          </Link>
        }
      />
      <div className="flex max-w-sm flex-col gap-1.5">
        <label htmlFor="hist-estado" className="text-base font-medium">
          Estado
        </label>
        <select
          id="hist-estado"
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-base"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value);
            setOffset(0);
          }}
        >
          {OPCIONES_ESTADO_SOLICITUD.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      </div>
      <div aria-live="polite" className="flex flex-col gap-4">
        {isLoading ? <VistaCargando mensaje="Cargando su historial…" onReintentar={() => mutate()} /> : null}
        {error ? <VistaError mensaje="No se pudo cargar su historial." onReintentar={() => mutate()} /> : null}
        {data && data.results.length === 0 ? (
          <VistaVacia titulo="Sin solicitudes" descripcion="Aún no tiene solicitudes de fe de vida con ese filtro." />
        ) : null}
        {data?.results.map((s) => {
          const p = PRESENTACION_SOLICITUD[s.estado];
          return (
            <details key={s.id} className="rounded-lg border bg-card p-4">
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-3 text-base">
                <StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} />
                <span>Enviada: {formatearFechaHora(s.fechaEnvio)}</span>
              </summary>
              <div className="mt-3">
                <SeguimientoSolicitud solicitud={s} />
              </div>
            </details>
          );
        })}
      </div>
      {data && data.count > 0 ? (
        <PaginacionNav
          etiqueta="Paginación del historial"
          total={data.count}
          offset={offset}
          limite={limite}
          onOffset={setOffset}
          tamanos={[10, 50]}
          onLimite={(l) => {
            setLimite(l);
            setOffset(0);
          }}
        />
      ) : null}
    </div>
  );
}
