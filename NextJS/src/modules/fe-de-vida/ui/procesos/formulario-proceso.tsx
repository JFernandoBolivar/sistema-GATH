"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import type { ProcesoDTO } from "../../application/dtos/fe-de-vida-dto";
import type { DatosProceso } from "../../domain/ports/repo-fe-de-vida";
import { normalizarDiasRecordatorio } from "../../domain/services/reglas";
import { listarTiposPensionAction } from "../../infrastructure/actions/fe-de-vida-actions";
import { aInputLocal } from "../comun/formato";
import { procesoSchema, type ProcesoValores } from "../schema/schema-fe-de-vida";
import { SelectorDiasRecordatorio } from "./selector-dias-recordatorio";

/** Del formulario a los datos del caso de uso: «Todos» = lista vacía de tipos. */
export function valoresADatosProceso(v: ProcesoValores): DatosProceso {
  return {
    nombre: v.nombre,
    apertura: v.apertura,
    cierre: v.cierre,
    tiposNomina: v.todos ? [] : v.tiposNomina,
    diasRecordatorio: normalizarDiasRecordatorio(v.diasRecordatorio),
  };
}

interface Props {
  proceso: ProcesoDTO | null;
  pendiente: boolean;
  onCerrar: () => void;
  onGuardar: (datos: DatosProceso) => void;
}

/** Crear o editar un proceso: nombre, fechas, alcance por tipos de pensión y días de recordatorio. */
export function FormularioProceso({ proceso, pendiente, onCerrar, onGuardar }: Props) {
  const tipos = useSWR("fe-de-vida-tipos-pension", async () => {
    const res = await listarTiposPensionAction();
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ProcesoValores>({
    resolver: zodResolver(procesoSchema),
    defaultValues: {
      nombre: proceso?.nombre ?? "",
      apertura: aInputLocal(proceso?.apertura),
      cierre: aInputLocal(proceso?.cierre),
      todos: !proceso || proceso.tiposNomina.length === 0,
      tiposNomina: proceso?.tiposNomina.map((t) => t.id) ?? [],
      diasRecordatorio: proceso ? [...proceso.diasRecordatorio] : [],
    },
  });
  const todos = useWatch({ control, name: "todos" });
  const elegidos = useWatch({ control, name: "tiposNomina" });

  function alternar(id: number, marcado: boolean) {
    setValue("tiposNomina", marcado ? [...new Set([...elegidos, id])] : elegidos.filter((x) => x !== id), {
      shouldValidate: true,
    });
  }

  const error = (campo: keyof ProcesoValores, id: string) =>
    errors[campo] ? (
      <p id={id} role="alert" className="text-sm font-medium text-danger">
        {errors[campo]?.message as string}
      </p>
    ) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form noValidate onSubmit={handleSubmit((v) => onGuardar(valoresADatosProceso(v)))} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{proceso ? "Editar proceso" : "Nuevo proceso de fe de vida"}</DialogTitle>
            <DialogDescription>El proceso se crea en preparación; luego puede abrirlo.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="p-nombre" className="text-base font-medium">Nombre</label>
            <Input id="p-nombre" aria-invalid={errors.nombre ? true : undefined} aria-describedby="p-nombre-e" {...register("nombre")} />
            {error("nombre", "p-nombre-e")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="p-apertura" className="text-base font-medium">Apertura</label>
              <Input id="p-apertura" type="datetime-local" aria-describedby="p-apertura-e" {...register("apertura")} />
              {error("apertura", "p-apertura-e")}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="p-cierre" className="text-base font-medium">Cierre</label>
              <Input id="p-cierre" type="datetime-local" aria-describedby="p-cierre-e" {...register("cierre")} />
              {error("cierre", "p-cierre-e")}
            </div>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-base font-medium">Alcance: tipos de pensión</legend>
            <label className="flex min-h-11 items-center gap-3 text-base">
              <input type="checkbox" className="size-5" {...register("todos")} />
              Todos los pasivos
            </label>
            {!todos ? (
              <div className="flex flex-col gap-1">
                {tipos.isLoading ? <VistaCargando mensaje="Cargando tipos…" /> : null}
                {tipos.error ? <VistaError mensaje="No se pudieron cargar los tipos." onReintentar={() => tipos.mutate()} /> : null}
                {tipos.data?.map((t) => (
                  <label key={t.id} className="flex min-h-11 items-center gap-3 text-base">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={elegidos.includes(t.id)}
                      onChange={(e) => alternar(t.id, e.target.checked)}
                    />
                    {t.nombre}
                  </label>
                ))}
              </div>
            ) : null}
            {error("tiposNomina", "p-tipos-e")}
          </fieldset>
          <Controller
            control={control}
            name="diasRecordatorio"
            render={({ field }) => (
              <SelectorDiasRecordatorio
                valor={field.value}
                onCambiar={(dias) => field.onChange(normalizarDiasRecordatorio(dias))}
                error={errors.diasRecordatorio ? "Revise los días de recordatorio." : undefined}
              />
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCerrar} disabled={pendiente}>Cancelar</Button>
            <Button type="submit" className="min-h-11" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
