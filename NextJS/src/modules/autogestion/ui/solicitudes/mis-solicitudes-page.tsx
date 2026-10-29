"use client";

import Link from "next/link";
import useSWR from "swr";
import { ChevronRight, FilePenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { LineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import type { SolicitudDTO } from "../../application/dtos/solicitud-dto";
import { nombreSeccion } from "../../domain/value-objects/campos-seccion";
import { listarMisSolicitudesAction } from "../../infrastructure/actions/solicitudes-actions";
import { PRESENTACION_ESTADO } from "../estado-solicitud-ui";
import { formatearFechaHora } from "../formato-solicitud";
import { hitosSolicitud } from "./hitos-solicitud";

/** «Mis solicitudes»: lista con estado, secciones y línea de tiempo de cada solicitud. */
export default function MisSolicitudesPage() {
  const { data, error, isLoading, mutate } = useSWR("mis-solicitudes", async () => {
    const res = await listarMisSolicitudesAction();
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        titulo="Mis solicitudes"
        descripcion="Aquí ve el avance de cada solicitud de actualización de sus datos."
        accion={
          <Button asChild size="lg">
            <Link href="/autogestion/solicitudes/nueva">
              <FilePenLine aria-hidden /> Solicitar actualización
            </Link>
          </Button>
        }
      />
      <ListaSolicitudes
        datos={error ? undefined : data}
        cargando={isLoading}
        recargar={() => mutate()}
      />
    </div>
  );
}

function ListaSolicitudes({
  datos,
  cargando,
  recargar,
}: {
  datos: SolicitudDTO[] | undefined;
  cargando: boolean;
  recargar: () => void;
}) {
  if (cargando) return <VistaCargando mensaje="Cargando sus solicitudes…" />;
  if (!datos)
    return <VistaError mensaje="No se pudieron cargar sus solicitudes." onReintentar={recargar} />;
  if (datos.length === 0) {
    return (
      <VistaVacia
        titulo="Aún no tiene solicitudes"
        descripcion="Cuando necesite corregir o completar sus datos, solicite la actualización y Bienestar Social le habilitará un plazo."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {datos.map((s) => {
        const p = PRESENTACION_ESTADO[s.estado];
        return (
          <li key={s.id} className="rounded-xl border bg-card p-5 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-semibold">
                  {s.seccionesSolicitadas.map(nombreSeccion).join(", ") || "Actualización de datos"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Solicitada el {formatearFechaHora(s.fechaSolicitud)}
                </p>
              </div>
              <StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} />
            </div>
            <p className="mt-2 text-base">{p.ayuda}</p>
            <LineaTiempo
              etiqueta="Avance de la solicitud"
              hitos={hitosSolicitud(s)}
              className="mt-4"
            />
            <Button
              asChild
              variant={s.estado === "HABILITADA" ? "default" : "outline"}
              className="mt-4"
            >
              <Link href={`/autogestion/solicitudes/${s.id}`}>
                {s.estado === "HABILITADA" ? "Completar mi actualización" : "Ver detalle"}{" "}
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
