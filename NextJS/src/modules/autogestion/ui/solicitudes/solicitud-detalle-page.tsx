"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { LineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import { puedeEditarBorrador } from "../../domain/services/reglas-solicitud";
import { nombreSeccion } from "../../domain/value-objects/campos-seccion";
import {
  listarSeccionesAction,
  obtenerMiSolicitudAction,
} from "../../infrastructure/actions/solicitudes-actions";
import { PRESENTACION_ESTADO } from "../estado-solicitud-ui";
import { formatearFechaHora } from "../formato-solicitud";
import { EditorBorrador } from "./editor-borrador";
import { hitosSolicitud } from "./hitos-solicitud";
import { ResumenCambios } from "./resumen-cambios";
import { useAhora } from "./use-ahora";
import { VentanaPlazo } from "./ventana-plazo";

/** Detalle de una solicitud propia: avance, plazo con cuenta regresiva y edición del borrador mientras la ventana esté vigente. */
export default function SolicitudDetallePage({ id }: { id: string }) {
  const ahora = useAhora();
  const { data, error, isLoading, mutate } = useSWR(["mi-solicitud", id], async () => {
    const res = await obtenerMiSolicitudAction(id);
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });
  const { data: secciones } = useSWR("secciones-autogestion", async () => {
    const res = await listarSeccionesAction();
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });

  const volver = (
    <Link
      href="/autogestion/solicitudes"
      className="inline-flex min-h-11 items-center gap-1 text-primary hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden /> Volver a mis solicitudes
    </Link>
  );

  if (isLoading) return <VistaCargando mensaje="Cargando la solicitud…" />;
  if (error || !data) {
    return (
      <div className="flex flex-col gap-4">
        {volver}
        <VistaError mensaje="No se pudo cargar la solicitud." onReintentar={() => mutate()} />
      </div>
    );
  }

  const p = PRESENTACION_ESTADO[data.estado];
  const editable = puedeEditarBorrador(data, ahora);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        migas={volver}
        titulo="Mi solicitud de actualización"
        descripcion={`Secciones: ${data.seccionesSolicitadas.map(nombreSeccion).join(", ")}. Solicitada el ${formatearFechaHora(data.fechaSolicitud)}.`}
        accion={<StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} className="text-base" />}
      />

      <div aria-live="polite" className="rounded-lg border bg-card p-4">
        <p className="text-base">{p.ayuda}</p>
        <p className="mt-2 text-sm text-muted-foreground">Motivo indicado: {data.motivo}</p>
      </div>

      {data.estado === "HABILITADA" ? <VentanaPlazo ventanaFin={data.ventanaFin} /> : null}

      <section aria-labelledby="avance" className="rounded-xl border bg-card p-5">
        <h2 id="avance" className="mb-4 text-xl font-bold">
          Avance
        </h2>
        <LineaTiempo etiqueta="Avance de la solicitud" hitos={hitosSolicitud(data)} />
        {data.prorrogas.length > 0 ? (
          <ul className="mt-4 border-t pt-3 text-sm text-muted-foreground">
            {data.prorrogas.map((pr) => (
              <li key={pr.id}>
                Plazo prorrogado hasta el {formatearFechaHora(pr.fechaFinNueva)}: {pr.motivo}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {data.estado === "HABILITADA" && !editable ? (
        <VistaError mensaje="El plazo venció. Ya no puede editar; solicite una nueva actualización si lo necesita." />
      ) : null}

      {editable && secciones ? (
        <EditorBorrador detalle={data} secciones={secciones} onActualizar={() => void mutate()} />
      ) : null}

      {!editable && data.estado !== "SOLICITADA" ? (
        <section aria-labelledby="cambios" className="flex flex-col gap-3">
          <h2 id="cambios" className="text-xl font-bold">
            Cambios de esta solicitud
          </h2>
          <ResumenCambios
            cambios={data.cambios}
            mostrarDecision={
              data.estado === "APROBADA" ||
              data.estado === "APROBADA_PARCIAL" ||
              data.estado === "RECHAZADA"
            }
          />
        </section>
      ) : null}
    </div>
  );
}
