"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, FilePenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { LineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import type { PaginaSolicitudesDTO } from "../../application/dtos/solicitud-dto";
import { LIMITE_BANDEJA } from "../../application/use-cases/gestionar-solicitud-bienestar";
import { etiquetaClaveCampo } from "../../domain/value-objects/campos-seccion";
import { listarMisSolicitudesAction } from "../../infrastructure/actions/solicitudes-actions";
import { OPCIONES_FILTRO_ESTADO, PRESENTACION_ESTADO } from "../estado-solicitud-ui";
import { formatearFechaHora } from "../formato-solicitud";
import { hitosSolicitud } from "./hitos-solicitud";
import { CLASE_CONTROL } from "./selector-catalogo";

/** «Mis solicitudes»: lista con estado, secciones y línea de tiempo de cada solicitud. */
export default function MisSolicitudesPage() {
  const [estado, setEstado] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [offset, setOffset] = useState(0);
  const rangoInvalido = Boolean(fechaDesde && fechaHasta && fechaDesde > fechaHasta);

  const { data, error, isLoading, mutate } = useSWR(
    rangoInvalido ? null : ["mis-solicitudes", estado, fechaDesde, fechaHasta, offset],
    async () => {
      const res = await listarMisSolicitudesAction({
        estado,
        fechaDesde,
        fechaHasta,
        limit: LIMITE_BANDEJA,
        offset,
      });
      if (!res.ok) throw new Error(res.mensaje);
      return res.datos;
    },
    { keepPreviousData: true },
  );

  const filtrar =
    (poner: (v: string) => void) =>
    (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      poner(ev.target.value);
      setOffset(0);
    };

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
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mis-filtro-estado" className="text-base font-medium">
            Estado
          </label>
          <select
            id="mis-filtro-estado"
            className={CLASE_CONTROL}
            value={estado}
            onChange={filtrar(setEstado)}
          >
            {OPCIONES_FILTRO_ESTADO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mis-filtro-desde" className="text-base font-medium">
            Solicitada desde
          </label>
          <input
            id="mis-filtro-desde"
            type="date"
            className={CLASE_CONTROL}
            value={fechaDesde}
            max={fechaHasta || undefined}
            onChange={filtrar(setFechaDesde)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="mis-filtro-hasta" className="text-base font-medium">
            Solicitada hasta
          </label>
          <input
            id="mis-filtro-hasta"
            type="date"
            className={CLASE_CONTROL}
            value={fechaHasta}
            min={fechaDesde || undefined}
            onChange={filtrar(setFechaHasta)}
          />
        </div>
        {rangoInvalido ? (
          <p role="alert" className="text-sm font-medium text-danger sm:col-span-3">
            La fecha inicial no puede ser posterior a la final.
          </p>
        ) : null}
      </div>
      <ListaSolicitudes
        datos={error ? undefined : data}
        cargando={isLoading}
        recargar={() => mutate()}
        offset={offset}
        onCambiarPagina={setOffset}
        hayFiltros={Boolean(estado || fechaDesde || fechaHasta)}
      />
    </div>
  );
}

function ListaSolicitudes({
  datos,
  cargando,
  recargar,
  offset,
  onCambiarPagina,
  hayFiltros,
}: {
  datos: PaginaSolicitudesDTO | undefined;
  cargando: boolean;
  recargar: () => void;
  offset: number;
  onCambiarPagina: (offset: number) => void;
  hayFiltros: boolean;
}) {
  if (cargando)
    return <VistaCargando mensaje="Cargando sus solicitudes…" onReintentar={recargar} />;
  if (!datos)
    return <VistaError mensaje="No se pudieron cargar sus solicitudes." onReintentar={recargar} />;
  if (datos.count === 0) {
    return hayFiltros ? (
      <VistaVacia
        titulo="Sin resultados"
        descripcion="Ninguna solicitud coincide con los filtros elegidos."
      />
    ) : (
      <VistaVacia
        titulo="Aún no tiene solicitudes"
        descripcion="Cuando necesite corregir o completar sus datos, solicite la actualización y Bienestar Social le habilitará un plazo."
      />
    );
  }
  const desde = offset + 1;
  const hasta = Math.min(offset + LIMITE_BANDEJA, datos.count);
  return (
    <>
      <ul className="flex flex-col gap-4">
        {datos.results.map((s) => {
          const p = PRESENTACION_ESTADO[s.estado];
          return (
            <li key={s.id} className="rounded-xl border bg-card p-5 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">
                    {s.camposSolicitados.map(etiquetaClaveCampo).join(", ") ||
                      "Actualización de datos"}
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
                variant={
                  s.estado === "HABILITADA" || s.estado === "DEVUELTA" ? "default" : "outline"
                }
                className="mt-4"
              >
                <Link href={`/autogestion/solicitudes/${s.id}`}>
                  {s.estado === "HABILITADA"
                    ? "Completar mi actualización"
                    : s.estado === "DEVUELTA"
                      ? "Corregir y reenviar"
                      : "Ver detalle"}{" "}
                  <ChevronRight aria-hidden />
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
      <nav
        aria-label="Paginación de mis solicitudes"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <p role="status" className="text-base text-muted-foreground">
          Mostrando {desde} a {hasta} de {datos.count}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={offset === 0}
            onClick={() => onCambiarPagina(Math.max(0, offset - LIMITE_BANDEJA))}
          >
            <ChevronLeft aria-hidden /> Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={offset + LIMITE_BANDEJA >= datos.count}
            onClick={() => onCambiarPagina(offset + LIMITE_BANDEJA)}
          >
            Siguiente <ChevronRight aria-hidden />
          </Button>
        </div>
      </nav>
    </>
  );
}
