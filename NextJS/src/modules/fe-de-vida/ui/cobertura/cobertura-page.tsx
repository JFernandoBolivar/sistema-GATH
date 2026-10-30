"use client";

import { useState } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailX, Search, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/shared/ui/components/page-header";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { CLASE_CONTROL } from "@/modules/autogestion/ui/solicitudes/selector-catalogo";
import { LIMITE_PAGINA } from "../../domain/value-objects/estados";
import {
  listarCoberturaAction,
  listarTiposPensionAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { PaginacionNav } from "../comun/paginacion-nav";
import { filtrosCoberturaSchema, type FiltrosCoberturaValores } from "../schema/schema-fe-de-vida";

const VACIOS: FiltrosCoberturaValores = { texto: "", tipoNominaId: "", sinCorreo: false, sinCuenta: false };

/** Pasivos sin correo o sin cuenta de acceso, para que RRHH les cargue el correo. */
export default function CoberturaPage() {
  const [filtros, setFiltros] = useState<FiltrosCoberturaValores>(VACIOS);
  const [offset, setOffset] = useState(0);
  const [limite, setLimite] = useState(LIMITE_PAGINA);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FiltrosCoberturaValores>({ resolver: zodResolver(filtrosCoberturaSchema), defaultValues: VACIOS });

  // El servidor entrega solo las nóminas de pasivos: no se filtra en el cliente.
  const tipos = useSWR("fe-de-vida-tipos-pension-cobertura", async () => {
    const res = await listarTiposPensionAction();
    return res.ok ? res.datos : [];
  });
  const { data, error, isLoading, mutate } = useSWR(["fe-de-vida-cobertura", filtros, offset, limite], async () => {
    const res = await listarCoberturaAction({
      texto: filtros.texto,
      tipoNominaId: filtros.tipoNominaId ? Number(filtros.tipoNominaId) : undefined,
      sinCorreo: filtros.sinCorreo,
      sinCuenta: filtros.sinCuenta,
      limit: limite,
      offset,
    });
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        titulo="Cobertura de pasivos"
        descripcion="Pasivos sin correo o sin cuenta de acceso. Sin correo no pueden ingresar a hacer su fe de vida."
      />
      <form
        noValidate
        onSubmit={handleSubmit((v) => {
          setOffset(0);
          setFiltros(v);
        })}
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-texto" className="text-base font-medium">Cédula o nombre</label>
          <Input id="c-texto" autoComplete="off" aria-invalid={errors.texto ? true : undefined} {...register("texto")} />
          {errors.texto ? <p role="alert" className="text-sm font-medium text-danger">{errors.texto.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-tipo" className="text-base font-medium">Tipo de pensión</label>
          <select id="c-tipo" className={CLASE_CONTROL} {...register("tipoNominaId")}>
            <option value="">Todos</option>
            {(tipos.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-base font-medium">Mostrar solo</legend>
          <label className="flex min-h-11 items-center gap-3 text-base">
            <input type="checkbox" className="size-5" {...register("sinCorreo")} /> Sin correo
          </label>
          <label className="flex min-h-11 items-center gap-3 text-base">
            <input type="checkbox" className="size-5" {...register("sinCuenta")} /> Sin cuenta de acceso
          </label>
        </fieldset>
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
        {isLoading ? <VistaCargando mensaje="Cargando pasivos…" onReintentar={() => mutate()} /> : null}
        {error ? <VistaError mensaje="No se pudo cargar la cobertura." onReintentar={() => mutate()} /> : null}
        {data && data.results.length === 0 ? <VistaVacia titulo="Sin resultados" descripcion="Ningún pasivo coincide con los filtros." /> : null}
        {data && data.results.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-left text-base">
              <caption className="sr-only">Pasivos sin correo o sin cuenta</caption>
              <thead className="border-b bg-muted text-sm">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Pasivo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Tipo de pensión</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Correo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Situación</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((p) => (
                  <tr key={p.cedula} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium">{p.nombreCompleto}</span>
                      <br />
                      <span className="text-sm text-muted-foreground">{p.cedula}</span>
                    </td>
                    <td className="px-4 py-3">{p.tipoNomina}</td>
                    <td className="px-4 py-3 break-all">{p.correo || "Sin correo"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {p.sinCorreo ? <StatusBadge texto="Sin correo" tono="warning" icono={MailX} /> : null}
                        {!p.tieneCuenta ? <StatusBadge texto="Sin cuenta" tono="danger" icono={UserX} /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      {data && data.count > 0 ? (
        <PaginacionNav
          etiqueta="Paginación de cobertura"
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
