"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { FieldCompare, type TipoDiferencia } from "@/shared/ui/components/field-compare";
import { LineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import { etiquetaCampo } from "@/modules/autogestion/domain/value-objects/campos-seccion";
import { formatearValor } from "@/modules/autogestion/ui/formato-solicitud";
import { useNombresCatalogo } from "@/modules/autogestion/ui/solicitudes/use-nombres-catalogo";
import type { CambioDTO } from "../../application/dtos/fe-de-vida-dto";
import { obtenerDetalleRevisionAction } from "../../infrastructure/actions/fe-de-vida-actions";
import { PRESENTACION_SOLICITUD } from "../comun/estado-ui";
import { hitosSolicitud } from "../pasivo/seguimiento-solicitud";
import { AccionesRevision } from "./acciones-revision";
import { VisorEvidencia } from "./visor-evidencia";
import { PERMISOS_FE_DE_VIDA } from "../../domain/value-objects/estados";
import { useSesionFeDeVida } from "../comun/use-sesion-fe-de-vida";

type Valor = Parameters<typeof formatearValor>[0];

export function tipoDiferencia(c: CambioDTO): TipoDiferencia {
  if (c.accion === "CREAR") return "nuevo";
  return JSON.stringify(c.valorActual ?? null) === JSON.stringify(c.valorPropuesto ?? null) ? "coincide" : "difiere";
}

/** Detalle de una fe de vida para Bienestar: foto, comparativo campo a campo y decisión. */
export default function DetalleRevisionPage({ id }: { id: string }) {
  const { puede } = useSesionFeDeVida();
  const { data, error, isLoading, mutate } = useSWR(["fe-de-vida-revision", id], async () => {
    const res = await obtenerDetalleRevisionAction(id);
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });
  const nombres = useNombresCatalogo(
    (data?.cambios ?? []).flatMap((c) => [
      { campo: c.campo, valorPropuesto: c.valorPropuesto },
      { campo: c.campo, valorPropuesto: c.valorActual },
    ]) as Array<{ campo: string; valorPropuesto: never }>,
  );

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
  const { solicitud, cambios } = data;
  const p = PRESENTACION_SOLICITUD[solicitud.estado];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        migas={volver}
        titulo={`Fe de vida de ${solicitud.nombre || solicitud.cedula}`}
        descripcion={`Cédula ${solicitud.cedula}`}
        accion={<StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} />}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {puede(PERMISOS_FE_DE_VIDA.verEvidencia) ? (
          <VisorEvidencia solicitudId={solicitud.id} />
        ) : (
          <p className="rounded-lg border bg-card p-4 text-base">No tiene permiso para ver la foto.</p>
        )}
        <div className="flex flex-col gap-4">
          <AccionesRevision solicitud={solicitud} onHecho={() => mutate()} />
          <LineaTiempo hitos={hitosSolicitud(solicitud)} etiqueta="Avance de la solicitud" />
        </div>
      </div>
      <section aria-labelledby="fv-cambios" className="flex flex-col gap-3">
        <h2 id="fv-cambios" className="text-xl font-semibold">
          Datos propuestos por el pasivo
        </h2>
        {cambios.length === 0 ? (
          <p className="text-base text-muted-foreground">El pasivo confirmó sus datos sin proponer cambios.</p>
        ) : (
          cambios.map((c) => (
            <FieldCompare
              key={c.id}
              id={`cambio-${c.id}`}
              etiqueta={etiquetaCampo(c.campo, c.entidad)}
              actual={formatearValor(c.valorActual as Valor, c.campo, nombres)}
              propuesto={formatearValor(c.valorPropuesto as Valor, c.campo, nombres)}
              diferencia={tipoDiferencia(c)}
              conflicto={c.conflicto}
            />
          ))
        )}
      </section>
    </div>
  );
}
