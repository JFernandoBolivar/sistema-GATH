"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import { formatearValor } from "@/modules/autogestion/ui/formato-solicitud";
import type { DetalleRevisionDTO } from "../../application/dtos/fe-de-vida-dto";
import { oficinaDeAdscripcion } from "../../domain/services/reglas";
import { PERMISOS_FE_DE_VIDA } from "../../domain/value-objects/estados";
import {
  descargarConstanciaBienestarAction,
  obtenerDetalleRevisionAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { PRESENTACION_SOLICITUD } from "../comun/estado-ui";
import { formatearFechaHora } from "../comun/formato";
import { useSesionFeDeVida } from "../comun/use-sesion-fe-de-vida";
import { AccionesRevision } from "./acciones-revision";
import { FichaRevision } from "./ficha-revision";
import { hitosRevision } from "./hitos-revision";
import { construirSecciones, type Formateador } from "./modelo-revision";
import { useNombresRevision } from "./use-nombres-revision";
import { VisorEvidencia } from "./visor-evidencia";
import { baseFeDeVida } from "../rutas-fe-de-vida";

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
    ["Canal", solicitud.canal === "PRESENCIAL" ? "Presencial" : "En línea"],
    ...(solicitud.canal === "PRESENCIAL" && solicitud.registradaPor
      ? [["Registrada por", solicitud.registradaPor] as [string, string]]
      : []),
    ...(solicitud.registradorTambienAprobo
      ? [["Aprobación", "Quien registró el acta también aprobó"] as [string, string]]
      : []),
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
  const { puede, cedula } = useSesionFeDeVida();
  const [imprimiendo, setImprimiendo] = useState(false);
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

  const pathname = usePathname();
  const volver = (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="min-h-10 gap-2 rounded-full px-4 shadow-xs"
    >
      <Link href={baseFeDeVida(pathname)}>
        <ArrowLeft className="size-4" aria-hidden /> Volver a la bandeja
      </Link>
    </Button>
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

  async function imprimirConstancia() {
    setImprimiendo(true);
    try {
      const res = await descargarConstanciaBienestarAction(solicitud.id);
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      const byteCharacters = atob(res.datos);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `constancia-${solicitud.cedula}.pdf`;
        a.click();
      }
    } catch {
      toast.error("No se pudo generar la constancia para impresión.");
    } finally {
      setImprimiendo(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        migas={volver}
        titulo={`Fe de vida de ${solicitud.nombre || solicitud.cedula}`}
        descripcion="Revise los datos que el pasivo declara frente a lo que hoy figura en su expediente."
        accion={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} />
            {solicitud.estado === "VALIDADA" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 gap-1.5"
                disabled={imprimiendo}
                onClick={imprimirConstancia}
              >
                {imprimiendo ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
                Imprimir constancia
              </Button>
            ) : null}
          </div>
        }
      />
      <Resumen detalle={data} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          {data.ficha === null ? (
            <p role="note" className="rounded-lg border bg-card p-4 text-base">
              No tiene permiso para ver la ficha completa del pasivo; se muestran solo los datos que propone.
            </p>
          ) : null}
          {solicitud.estado === "BORRADOR" ? (
            <p className="rounded-lg border bg-card p-4 text-base text-muted-foreground">
              La solicitud está en borrador. El pasivo aún no ha enviado sus datos.
            </p>
          ) : data.cambios.length === 0 ? (
            <p className="rounded-lg border bg-card p-4 text-base text-muted-foreground">
              El pasivo confirmó sus datos sin proponer cambios.
            </p>
          ) : null}
          <FichaRevision secciones={secciones} />
        </div>
        <aside
          aria-label="Foto y decisión"
          className="order-1 flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:order-2 lg:max-h-[calc(100dvh-2rem)]"
        >
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-4">
          {puede(PERMISOS_FE_DE_VIDA.verEvidencia) ? (
            <VisorEvidencia
              solicitudId={solicitud.id}
              estadoSolicitud={solicitud.estado}
              tieneEvidencia={solicitud.tieneEvidencia}
            />
          ) : (
            <p className="rounded-lg border bg-card p-4 text-base">No tiene permiso para ver la foto.</p>
          )}
          <AccionesRevision
            solicitud={solicitud}
            acciones={acciones}
            onHecho={() => mutate()}
            esRegistrador={
              solicitud.canal === "PRESENCIAL" &&
              !!solicitud.registradaPorCedula &&
              solicitud.registradaPorCedula === cedula
            }
          />
          <LineaTiempo hitos={hitosRevision(solicitud)} etiqueta="Avance de la solicitud" />
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
