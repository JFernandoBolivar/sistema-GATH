"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { etiquetaClaveCampo } from "../../domain/value-objects/campos-seccion";
import { LIMITE_BANDEJA } from "../../application/use-cases/gestionar-solicitud-bienestar";
import { listarBandejaAction } from "../../infrastructure/actions/solicitudes-actions";
import { OPCIONES_FILTRO_ESTADO, PRESENTACION_ESTADO } from "../estado-solicitud-ui";
import { formatearFechaHora } from "../formato-solicitud";
import { CLASE_CONTROL } from "../solicitudes/selector-catalogo";
import { filtrosBandejaSchema } from "../schema/schema-solicitud";

/** Bandeja de Bienestar Social: solicitudes de actualización con filtros y paginación. */
export default function BandejaSolicitudesPage() {
  const [estado, setEstado] = useState("");
  const [cedulaTexto, setCedulaTexto] = useState("");
  const [cedula, setCedula] = useState("");
  const [errorFiltro, setErrorFiltro] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const { data, error, isLoading, mutate } = useSWR(
    ["bandeja-bienestar", estado, cedula, offset],
    async () => {
      const res = await listarBandejaAction({ estado, cedula, limit: LIMITE_BANDEJA, offset });
      if (!res.ok) throw new Error(res.mensaje);
      return res.datos;
    },
  );

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const v = filtrosBandejaSchema.safeParse({ estado, cedula: cedulaTexto });
    if (!v.success) {
      setErrorFiltro(v.error.issues[0]?.message ?? "Filtro inválido");
      return;
    }
    setErrorFiltro(null);
    setOffset(0);
    setCedula(cedulaTexto.trim());
  }

  const total = data?.count ?? 0;
  const desde = total === 0 ? 0 : offset + 1;
  const hasta = Math.min(offset + LIMITE_BANDEJA, total);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        titulo="Solicitudes de actualización de datos"
        descripcion="Revise, habilite plazos y decida las solicitudes de los trabajadores."
      />

      <form
        onSubmit={buscar}
        noValidate
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtro-estado" className="text-base font-medium">
            Estado
          </label>
          <select
            id="filtro-estado"
            className={CLASE_CONTROL}
            value={estado}
            onChange={(ev) => {
              setEstado(ev.target.value);
              setOffset(0);
            }}
          >
            {OPCIONES_FILTRO_ESTADO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filtro-cedula" className="text-base font-medium">
            Cédula del trabajador
          </label>
          <Input
            id="filtro-cedula"
            inputMode="numeric"
            autoComplete="off"
            value={cedulaTexto}
            onChange={(ev) => setCedulaTexto(ev.target.value)}
            aria-invalid={errorFiltro ? true : undefined}
            aria-describedby={errorFiltro ? "filtro-error" : undefined}
          />
          {errorFiltro ? (
            <p id="filtro-error" className="text-sm font-medium text-danger">
              {errorFiltro}
            </p>
          ) : null}
        </div>
        <Button type="submit">
          <Search aria-hidden /> Buscar
        </Button>
      </form>

      {isLoading ? <VistaCargando mensaje="Cargando solicitudes…" onReintentar={() => mutate()} /> : null}
      {error ? (
        <VistaError
          mensaje="No se pudo cargar la bandeja de solicitudes."
          onReintentar={() => mutate()}
        />
      ) : null}
      {data && data.results.length === 0 ? (
        <VistaVacia
          titulo="No hay solicitudes"
          descripcion="Ninguna solicitud coincide con los filtros elegidos."
        />
      ) : null}

      {data && data.results.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[640px] text-left text-base">
              <caption className="sr-only">Solicitudes de actualización de datos</caption>
              <thead className="border-b bg-muted text-sm">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Cédula
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Campos solicitados
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Solicitada
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((s) => {
                  const p = PRESENTACION_ESTADO[s.estado];
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{s.cedula}</td>
                      <td className="px-4 py-3">
                        {s.camposSolicitados.map(etiquetaClaveCampo).join(", ")}
                      </td>
                      <td className="px-4 py-3">{formatearFechaHora(s.fechaSolicitud)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/personal/bienestar/solicitudes/${s.id}`}
                            aria-label={`Abrir la solicitud de ${s.cedula}`}
                          >
                            Abrir <ChevronRight aria-hidden />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <nav
            aria-label="Paginación de la bandeja"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p role="status" className="text-base text-muted-foreground">
              Mostrando {desde} a {hasta} de {total}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMITE_BANDEJA))}
              >
                <ChevronLeft aria-hidden /> Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={offset + LIMITE_BANDEJA >= total}
                onClick={() => setOffset(offset + LIMITE_BANDEJA)}
              >
                Siguiente <ChevronRight aria-hidden />
              </Button>
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}
