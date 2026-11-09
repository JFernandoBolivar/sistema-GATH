"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { LIMITE_PAGINA } from "../../domain/value-objects/estados";
import { listarMisSolicitudesAction } from "../../infrastructure/actions/fe-de-vida-actions";
import { OPCIONES_ESTADO_SOLICITUD, PRESENTACION_SOLICITUD } from "../comun/estado-ui";
import { formatearFechaHora } from "../comun/formato";
import { PaginacionNav } from "../comun/paginacion-nav";
import { SeguimientoSolicitud } from "./seguimiento-solicitud";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

/** Radix no admite value="" en un ítem: «Todos los estados» usa este centinela. */
const TODOS = "__todos__";

/** Historial de fe de vida del pasivo: una solicitud por proceso, paginado y filtrable por estado. */
export default function HistorialFeDeVidaPage() {
  const [estado, setEstado] = useState("");
  const [offset, setOffset] = useState(0);
  const [limite, setLimite] = useState(LIMITE_PAGINA);
  const { data, error, isLoading, mutate } = useSWR(
    ["fe-de-vida-historial", estado, offset, limite],
    async () => {
      const res = await listarMisSolicitudesAction({ estado, limit: limite, offset });
      if (!res.ok) throw new Error(res.mensaje);
      return res.datos;
    },
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        titulo="Historial de fe de vida"
        descripcion="Sus solicitudes en cada proceso."
        migas={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-10 gap-2 rounded-full px-4 shadow-xs"
          >
            <Link href="/autogestion/fe-de-vida">
              <ArrowLeft className="size-4" aria-hidden /> Volver a fe de vida
            </Link>
          </Button>
        }
      />
      <div className="flex max-w-sm flex-col gap-1.5">
        <label htmlFor="hist-estado" className="text-base font-medium">
          Estado
        </label>
        <Select
          value={estado || TODOS}
          onValueChange={(v) => {
            setEstado(v === TODOS ? "" : v);
            setOffset(0);
          }}
        >
          <SelectTrigger id="hist-estado" className="h-11 w-full bg-card text-base shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPCIONES_ESTADO_SOLICITUD.map((o) => (
              <SelectItem key={o.valor || TODOS} value={o.valor || TODOS} className="text-base">
                {o.texto}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div aria-live="polite" className="flex flex-col gap-4">
        {isLoading ? (
          <VistaCargando mensaje="Cargando su historial…" onReintentar={() => mutate()} />
        ) : null}
        {error ? (
          <VistaError mensaje="No se pudo cargar su historial." onReintentar={() => mutate()} />
        ) : null}
        {data && data.results.length === 0 ? (
          <VistaVacia
            titulo="Sin solicitudes"
            descripcion="Aún no tiene solicitudes de fe de vida con ese filtro."
          />
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
