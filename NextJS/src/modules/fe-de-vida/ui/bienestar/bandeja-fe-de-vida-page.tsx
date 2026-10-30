"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { CLASE_CONTROL } from "@/modules/autogestion/ui/solicitudes/selector-catalogo";
import { LIMITE_PAGINA } from "../../domain/value-objects/estados";
import {
  listarBandejaAction,
  listarProcesosAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { OPCIONES_ESTADO_SOLICITUD, PRESENTACION_SOLICITUD } from "../comun/estado-ui";
import { formatearFechaHora } from "../comun/formato";
import { PaginacionNav } from "../comun/paginacion-nav";
import { filtrosBandejaSchema, type FiltrosBandejaValores } from "../schema/schema-fe-de-vida";

const VACIOS: FiltrosBandejaValores = { texto: "", estado: "", procesoId: "", desde: "", hasta: "" };

/** Bandeja de Bienestar: fe de vida de los pasivos, paginada (10/50) y filtrable. */
export default function BandejaFeDeVidaPage() {
  const [filtros, setFiltros] = useState<FiltrosBandejaValores>(VACIOS);
  const [offset, setOffset] = useState(0);
  const [limite, setLimite] = useState(LIMITE_PAGINA);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FiltrosBandejaValores>({ resolver: zodResolver(filtrosBandejaSchema), defaultValues: VACIOS });

  const procesos = useSWR("fe-de-vida-procesos-filtro", async () => {
    const res = await listarProcesosAction({ limit: 50, offset: 0 });
    return res.ok ? res.datos.results : [];
  });
  const { data, error, isLoading, mutate } = useSWR(["fe-de-vida-bandeja", filtros, offset, limite], async () => {
    const res = await listarBandejaAction({ ...filtros, limit: limite, offset });
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader titulo="Fe de vida del personal pasivo" descripcion="Revise las fe de vida enviadas por los pasivos." />
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
            <option value="">Todos los procesos</option>
            {(procesos.data ?? []).map((p) => (
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
          <VistaVacia titulo="No hay solicitudes" descripcion="Ninguna fe de vida coincide con los filtros." />
        ) : null}
        {data && data.results.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border bg-card">
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
                      <td className="px-4 py-3"><StatusBadge texto={p.texto} tono={p.tono} icono={p.icono} /></td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="outline" className="min-h-11">
                          <Link href={`/personal/fe-de-vida/${s.id}`} aria-label={`Abrir la fe de vida de ${s.nombre || s.cedula}`}>
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
    </div>
  );
}
