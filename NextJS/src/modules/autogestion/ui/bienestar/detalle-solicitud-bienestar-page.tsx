"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { ArrowLeft, CalendarClock, CalendarPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import {
  puedeDecidir,
  puedeHabilitar,
  puedeProrrogar,
  puedeRechazarTotal,
} from "../../domain/services/reglas-solicitud";
import { nombreSeccion } from "../../domain/value-objects/campos-seccion";
import {
  obtenerComparativoAction,
  obtenerDetalleBienestarAction,
} from "../../infrastructure/actions/solicitudes-actions";
import { PRESENTACION_ESTADO } from "../estado-solicitud-ui";
import { formatearFechaHora } from "../formato-solicitud";
import { hitosSolicitud } from "../solicitudes/hitos-solicitud";
import { VentanaPlazo } from "../solicitudes/ventana-plazo";
import { DialogoHabilitar, DialogoProrrogar, DialogoRechazarSolicitud } from "./dialogos-ventana";
import { VisorComparativo } from "./visor-comparativo";

/** Detalle de una solicitud para Bienestar: acciones de plazo, línea de tiempo y visor comparativo. */
export default function DetalleSolicitudBienestarPage({ id }: { id: string }) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const [dialogo, setDialogo] = useState<"habilitar" | "prorrogar" | "rechazar" | null>(null);

  const { data, error, isLoading, mutate } = useSWR(["bienestar-detalle", id], async () => {
    // Sin el permiso de revisión (solo lectura) se cae al detalle simple.
    const res = await obtenerComparativoAction(id);
    if (res.ok) return res.datos;
    const lectura = await obtenerDetalleBienestarAction(id);
    if (!lectura.ok) throw new Error(lectura.mensaje);
    return lectura.datos;
  });

  const volver = (
    <Link
      href="/personal/bienestar/solicitudes"
      className="inline-flex min-h-11 items-center gap-1 text-primary hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden /> Volver a la bandeja
    </Link>
  );

  if (isLoading)
    return (
      <div className="p-4 md:p-6">
        <VistaCargando mensaje="Cargando la solicitud…" />
      </div>
    );
  if (error || !data) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        {volver}
        <VistaError mensaje="No se pudo cargar la solicitud." onReintentar={() => mutate()} />
      </div>
    );
  }

  const p = PRESENTACION_ESTADO[data.estado];
  const esPropia = Boolean(session?.user?.cedula) && String(session?.user?.cedula) === data.cedula;
  const puedeAprobar = tienePermiso(permisos, "bienestar.aprobar");
  const puedeRevisar = tienePermiso(permisos, "bienestar.revisar_actualizacion");
  const recargar = () => void mutate();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        migas={volver}
        titulo={`Solicitud de la cédula ${data.cedula}`}
        descripcion={`Secciones: ${data.seccionesSolicitadas.map(nombreSeccion).join(", ")}. Solicitada el ${formatearFechaHora(data.fechaSolicitud)}.`}
        accion={<StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} className="text-base" />}
      />

      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm font-medium text-muted-foreground">Motivo del trabajador</p>
        <p className="text-base">{data.motivo}</p>
        {data.motivoDecision ? (
          <p className="mt-2 text-base">
            <span className="font-medium">Resolución:</span> {data.motivoDecision}
            {data.decididaPor ? ` (por ${data.decididaPor})` : ""}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {puedeHabilitar(data) && tienePermiso(permisos, "bienestar.habilitar_ventana") ? (
          <Button size="lg" onClick={() => setDialogo("habilitar")}>
            <CalendarPlus aria-hidden /> Habilitar plazo
          </Button>
        ) : null}
        {puedeProrrogar(data) && tienePermiso(permisos, "bienestar.prorrogar_ventana") ? (
          <Button size="lg" variant="outline" onClick={() => setDialogo("prorrogar")}>
            <CalendarClock aria-hidden /> Prorrogar plazo
          </Button>
        ) : null}
        {puedeRechazarTotal(data) &&
        puedeRevisar &&
        (data.estado !== "ENVIADA" || (puedeAprobar && !esPropia)) ? (
          <Button size="lg" variant="outline" onClick={() => setDialogo("rechazar")}>
            <XCircle aria-hidden /> Rechazar solicitud
          </Button>
        ) : null}
      </div>

      {data.estado === "HABILITADA" ? <VentanaPlazo ventanaFin={data.ventanaFin} /> : null}

      <section aria-labelledby="avance-b" className="rounded-xl border bg-card p-5">
        <h2 id="avance-b" className="mb-4 text-xl font-bold">
          Avance
        </h2>
        <LineaTiempo etiqueta="Avance de la solicitud" hitos={hitosSolicitud(data)} />
        {data.prorrogas.length > 0 ? (
          <ul className="mt-4 border-t pt-3 text-sm text-muted-foreground">
            {data.prorrogas.map((pr) => (
              <li key={pr.id}>
                {formatearFechaHora(pr.fecha)}: plazo prorrogado hasta el{" "}
                {formatearFechaHora(pr.fechaFinNueva)} por {pr.prorrogadaPor}. Motivo: {pr.motivo}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {data.cambios.length > 0 ? (
        <VisorComparativo
          detalle={data}
          puedeDecidir={puedeDecidir(data) && puedeAprobar && !esPropia}
          motivoBloqueo={
            puedeDecidir(data)
              ? esPropia
                ? "Es su propia solicitud: otra persona de Bienestar Social debe decidirla."
                : !puedeAprobar
                  ? "Puede revisar la solicitud, pero no tiene permiso para aprobarla."
                  : undefined
              : undefined
          }
          onDecidido={recargar}
        />
      ) : (
        <p className="rounded-lg border bg-card p-4 text-base text-muted-foreground">
          Todavía no hay cambios propuestos: el trabajador los cargará cuando se habilite el plazo.
        </p>
      )}

      <DialogoHabilitar
        solicitud={data}
        abierto={dialogo === "habilitar"}
        onAbiertoChange={(a) => setDialogo(a ? "habilitar" : null)}
        onHecho={recargar}
      />
      <DialogoProrrogar
        solicitud={data}
        abierto={dialogo === "prorrogar"}
        onAbiertoChange={(a) => setDialogo(a ? "prorrogar" : null)}
        onHecho={recargar}
      />
      <DialogoRechazarSolicitud
        solicitud={data}
        abierto={dialogo === "rechazar"}
        onAbiertoChange={(a) => setDialogo(a ? "rechazar" : null)}
        onHecho={recargar}
      />
    </div>
  );
}
