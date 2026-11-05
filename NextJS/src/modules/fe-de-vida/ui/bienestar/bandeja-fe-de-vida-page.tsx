"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { LIMITE_PAGINA } from "../../domain/value-objects/estados";
import {
  listarBandejaAction,
  listarProcesosAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { OPCIONES_ESTADO_SOLICITUD, PRESENTACION_SOLICITUD } from "../comun/estado-ui";
import { formatearFechaHora } from "../comun/formato";
import { PaginacionNav } from "../comun/paginacion-nav";
import { filtrosBandejaSchema, type FiltrosBandejaValores } from "../schema/schema-fe-de-vida";
import { baseFeDeVida } from "../rutas-fe-de-vida";

type PestanaBandeja = "vigente" | "historico";

const CLASE_CONTROL =
  "min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground disabled:cursor-not-allowed disabled:opacity-60";

const VACIOS: FiltrosBandejaValores = { texto: "", estado: "", procesoId: "", desde: "", hasta: "" };

/** Bandeja de Bienestar: fe de vida de los pasivos (proceso vigente o histórico), paginada y filtrable. */
export default function BandejaFeDeVidaPage() {
  const pathname = usePathname();
  const base = baseFeDeVida(pathname);
  const [pestana, setPestana] = useState<PestanaBandeja>("vigente");
  const [filtros, setFiltros] = useState<FiltrosBandejaValores>(VACIOS);
  const [offset, setOffset] = useState(0);
  const [limite, setLimite] = useState(LIMITE_PAGINA);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FiltrosBandejaValores>({ resolver: zodResolver(filtrosBandejaSchema), defaultValues: VACIOS });

  const esHistorico = pestana === "historico";

  const procesosAbiertos = useSWR("fe-de-vida-procesos-abiertos-filtro", async () => {
    const res = await listarProcesosAction({ estado: "ABIERTO", limit: 50, offset: 0 });
    return res.ok ? res.datos.results : [];
  });

  const procesosCerrados = useSWR(esHistorico ? "fe-de-vida-procesos-cerrados-filtro" : null, async () => {
    const res = await listarProcesosAction({ estado: "CERRADO", limit: 50, offset: 0 });
    return res.ok ? res.datos.results : [];
  });

  const procesosParaFiltro = esHistorico ? (procesosCerrados.data ?? []) : (procesosAbiertos.data ?? []);

  const { data, error, isLoading, mutate } = useSWR(
    ["fe-de-vida-bandeja", pestana, filtros, offset, limite],
    async () => {
      const res = await listarBandejaAction({
        ...filtros,
        historico: esHistorico,
        limit: limite,
        offset,
      });
      if (!res.ok) throw new Error(res.mensaje);
      return res.datos;
    },
  );

  function cambiarPestana(nueva: PestanaBandeja) {
    setPestana(nueva);
    setOffset(0);
    reset(VACIOS);
    setFiltros(VACIOS);
  }

  const sinProcesoAbierto = !esHistorico && !procesosAbiertos.isLoading && (procesosAbiertos.data ?? []).length === 0;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        titulo={esHistorico ? "Histórico de fe de vida" : "Fe de vida del personal pasivo"}
        descripcion={
          esHistorico
            ? "Consulte las solicitudes de fe de vida de procesos cerrados (solo lectura)."
            : "Revise las fe de vida enviadas por los pasivos en el proceso vigente."
        }
      />

      <Tabs value={pestana} onValueChange={(v) => cambiarPestana(v as PestanaBandeja)} className="w-full">
        <TabsList>
          <TabsTrigger value="vigente" className="min-h-10 text-base">
            Proceso vigente
          </TabsTrigger>
          <TabsTrigger value="historico" className="min-h-10 text-base">
            <History className="mr-1.5 size-4" aria-hidden /> Histórico
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {sinProcesoAbierto ? (
        <div aria-live="polite" className="flex flex-col gap-4">
          <VistaVacia
            titulo="No hay un proceso de fe de vida abierto"
            descripcion="Actualmente no hay ningún proceso abierto de fe de vida. Puede consultar las solicitudes de procesos anteriores en el apartado histórico."
          />
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => cambiarPestana("historico")}
            >
              <History className="mr-1.5 size-4" aria-hidden /> Ver histórico de procesos
            </Button>
          </div>
        </div>
      ) : (
        <>
          <form
            noValidate
            onSubmit={handleSubmit((v) => {
              setOffset(0);
              setFiltros(v);
            })}
            className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="b-texto" className="text-base font-medium">Cédula o nombre</label>
              <Input id="b-texto" autoComplete="off" aria-invalid={errors.texto ? true : undefined} {...register("texto")} />
              {errors.texto ? <p role="alert" className="text-sm font-medium text-danger">{errors.texto.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="b-estado" className="text-base font-medium">Estado</label>
              <select id="b-estado" className={CLASE_CONTROL} {...register("estado")}>
                {OPCIONES_ESTADO_SOLICITUD.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.texto}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="b-proceso" className="text-base font-medium">Proceso</label>
              <select id="b-proceso" className={CLASE_CONTROL} {...register("procesoId")}>
                <option value="">
                  {esHistorico ? "Todos los procesos cerrados" : "Todos los procesos abiertos"}
                </option>
                {procesosParaFiltro.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="b-desde" className="text-base font-medium">Enviada desde</label>
              <Input id="b-desde" type="date" {...register("desde")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="b-hasta" className="text-base font-medium">Enviada hasta</label>
              <Input id="b-hasta" type="date" aria-invalid={errors.hasta ? true : undefined} {...register("hasta")} />
              {errors.hasta ? <p role="alert" className="text-sm font-medium text-danger">{errors.hasta.message}</p> : null}
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" className="min-h-11"><Search aria-hidden /> Buscar</Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  reset(VACIOS);
                  setFiltros(VACIOS);
                  setOffset(0);
                }}
              >
                Limpiar
              </Button>
            </div>
          </form>

          <div aria-live="polite" className="flex flex-col gap-4">
            {isLoading ? <VistaCargando mensaje="Cargando solicitudes…" onReintentar={() => mutate()} /> : null}
            {error ? <VistaError mensaje="No se pudo cargar la bandeja." onReintentar={() => mutate()} /> : null}
            {data && data.results.length === 0 ? (
              <VistaVacia
                titulo={esHistorico ? "No hay solicitudes en el histórico" : "No hay solicitudes"}
                descripcion={
                  esHistorico
                    ? "Ninguna fe de vida de procesos cerrados coincide con los filtros."
                    : "Ninguna fe de vida coincide con los filtros."
                }
              />
            ) : null}
            {data && data.results.length > 0 ? (
              <div role="region" aria-label="Fe de vida del personal pasivo" tabIndex={0} className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full min-w-[640px] text-left text-base">
                  <caption className="sr-only">Fe de vida del personal pasivo</caption>
                  <thead className="border-b bg-muted text-sm">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Pasivo</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Enviada</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Acción</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((s) => {
                      const p = PRESENTACION_SOLICITUD[s.estado];
                      return (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <span className="font-medium">{s.nombre || "Sin nombre"}</span>
                            <br />
                            <span className="text-sm text-muted-foreground">{s.cedula}</span>
                          </td>
                          <td className="px-4 py-3">{formatearFechaHora(s.fechaEnvio)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} />
                              {s.canal === "PRESENCIAL" ? (
                                <span
                                  className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-semibold text-secondary-foreground"
                                  title={s.registradaPor ? `Registrada por: ${s.registradaPor}` : "Registrada presencialmente"}
                                >
                                  Presencial
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  En línea
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button asChild variant="outline" className="min-h-11">
                              <Link
                                href={`${base}/${s.id}`}
                                aria-label={
                                  esHistorico
                                    ? `Ver detalle de la fe de vida de ${s.nombre || s.cedula}`
                                    : `Abrir la fe de vida de ${s.nombre || s.cedula}`
                                }
                              >
                                {esHistorico ? "Ver detalle" : "Abrir"} <ChevronRight aria-hidden />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          {data && data.count > 0 ? (
            <PaginacionNav
              etiqueta="Paginación de la bandeja"
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
        </>
      )}
    </div>
  );
}
