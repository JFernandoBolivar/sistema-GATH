"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { LineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import { formatearValor } from "@/modules/autogestion/ui/formato-solicitud";
import type { DetalleRevisionDTO } from "../../application/dtos/fe-de-vida-dto";
import { oficinaDeAdscripcion } from "../../domain/services/reglas";
import { PERMISOS_FE_DE_VIDA } from "../../domain/value-objects/estados";
import { obtenerDetalleRevisionAction } from "../../infrastructure/actions/fe-de-vida-actions";
import { PRESENTACION_SOLICITUD } from "../comun/estado-ui";
import { formatearFechaHora } from "../comun/formato";
import { useSesionFeDeVida } from "../comun/use-sesion-fe-de-vida";
import { AccionesRevision } from "./acciones-revision";
import { FichaRevision } from "./ficha-revision";
import { hitosRevision } from "./hitos-revision";
import { construirSecciones, type Formateador } from "./modelo-revision";
import { useNombresRevision } from "./use-nombres-revision";
import { VisorEvidencia } from "./visor-evidencia";

type Valor = Parameters<typeof formatearValor>[0];

function Resumen({ detalle }: { detalle: DetalleRevisionDTO }) {
  const { solicitud, ficha, procesoNombre } = detalle;
  const asig = ficha?.asignacion;
  const oficina = asig
    ? oficinaDeAdscripcion({
        dependencia: asig.dependencia,
        direccion_general: asig.direccionGeneral,
        direccion_linea: asig.direccionLinea,
        coordinacion: asig.coordinacion,
      })
    : null;
  const datos: Array<[string, string]> = [
    ["Cédula", solicitud.cedula],
    ["Tipo de pensión", asig?.tipoNomina ?? "Sin dato"],
    ["Oficina de adscripción", oficina ?? "Sin dato"],
    ["Proceso", procesoNombre || "Sin dato"],
    ["Fecha de envío", formatearFechaHora(solicitud.fechaEnvio)],
  ];
  return (
    <section aria-label="Resumen de la solicitud" className="rounded-lg border bg-card p-4">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {datos.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex flex-col gap-0.5">
            <dt className="text-sm font-medium text-muted-foreground">{etiqueta}</dt>
            <dd className="break-words text-base font-medium">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Revisión de una fe de vida: resumen, ficha completa con lo declarado, foto y decisión. */
export default function DetalleRevisionPage({ id }: { id: string }) {
  const { puede } = useSesionFeDeVida();
  const { data, error, isLoading, mutate } = useSWR(["fe-de-vida-revision", id], async () => {
    const res = await obtenerDetalleRevisionAction(id);
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });
  const nombres = useNombresRevision(data?.cambios ?? [], data?.ficha ?? null);
  const secciones = useMemo(() => {
    if (!data) return [];
    const formatear: Formateador = (valor, campo) => formatearValor(valor as Valor, campo, nombres);
    return construirSecciones({ ficha: data.ficha, cambios: data.cambios, formatear, hoy: new Date() });
  }, [data, nombres]);

  const volver = (
    <Link href="/personal/fe-de-vida" className="inline-flex min-h-11 items-center gap-1 text-primary hover:underline">
      <ArrowLeft className="size-4" aria-hidden /> Volver a la bandeja
    </Link>
  );

  if (isLoading) return <div className="p-4 md:p-6"><VistaCargando mensaje="Cargando la solicitud…" onReintentar={() => mutate()} /></div>;
  if (error || !data) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        {volver}
        <VistaError mensaje="No se pudo cargar la solicitud." onReintentar={() => mutate()} />
      </div>
    );
  }
  const { solicitud, acciones } = data;
  const p = PRESENTACION_SOLICITUD[solicitud.estado];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        migas={volver}
        titulo={`Fe de vida de ${solicitud.nombre || solicitud.cedula}`}
        descripcion="Revise los datos que el pasivo declara frente a lo que hoy figura en su expediente."
        accion={<StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} />}
      />
      <Resumen detalle={data} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          {data.ficha === null ? (
            <p role="note" className="rounded-lg border bg-card p-4 text-base">
              No tiene permiso para ver la ficha completa del pasivo; se muestran solo los datos que propone.
            </p>
          ) : null}
          {data.cambios.length === 0 ? (
            <p className="rounded-lg border bg-card p-4 text-base text-muted-foreground">
              El pasivo confirmó sus datos sin proponer cambios.
            </p>
          ) : null}
          <FichaRevision secciones={secciones} />
        </div>
        <aside
          aria-label="Foto y decisión"
          className="order-1 flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:order-2 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
        >
          {puede(PERMISOS_FE_DE_VIDA.verEvidencia) ? (
            <VisorEvidencia solicitudId={solicitud.id} />
          ) : (
            <p className="rounded-lg border bg-card p-4 text-base">No tiene permiso para ver la foto.</p>
          )}
          <AccionesRevision solicitud={solicitud} acciones={acciones} onHecho={() => mutate()} />
          <LineaTiempo hitos={hitosRevision(solicitud)} etiqueta="Avance de la solicitud" />
        </aside>
      </div>
    </div>
  );
}
