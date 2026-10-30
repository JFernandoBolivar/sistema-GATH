"use client";

import { useTransition } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { Textarea } from "@/shared/ui/components/textarea";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import type { ProcesoDTO } from "../../application/dtos/fe-de-vida-dto";
import {
  listarProrrogasAction,
  prorrogarProcesoAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { formatearFechaHora } from "../comun/formato";
import { prorrogaSchema, type ProrrogaValores } from "../schema/schema-fe-de-vida";

/** Prórroga individual (con cédula) o general (sin cédula) y su historial por proceso. */
export function DialogoProrrogas({ proceso, onCerrar }: { proceso: ProcesoDTO; onCerrar: () => void }) {
  const [pendiente, iniciar] = useTransition();
  const historial = useSWR(["fe-de-vida-prorrogas", proceso.id], async () => {
    const res = await listarProrrogasAction(proceso.id);
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProrrogaValores>({
    resolver: zodResolver(prorrogaSchema),
    defaultValues: { cedula: "", nuevaFechaLimite: "", motivo: "" },
  });

  function conceder(v: ProrrogaValores) {
    iniciar(async () => {
      const res = await prorrogarProcesoAction(proceso.id, {
        nuevaFechaLimite: v.nuevaFechaLimite,
        motivo: v.motivo,
        cedula: v.cedula || undefined,
      });
      if (!res.ok) {
        toast.error(res.mensaje);
        return;
      }
      toast.success(res.mensaje);
      reset();
      void historial.mutate();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Prórrogas de «{proceso.nombre}»</DialogTitle>
          <DialogDescription>
            Con cédula, la prórroga es individual. Sin cédula, es general para todos los pasivos.
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(conceder)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pr-cedula" className="text-base font-medium">Cédula (opcional)</label>
            <Input id="pr-cedula" inputMode="numeric" autoComplete="off" aria-invalid={errors.cedula ? true : undefined} {...register("cedula")} />
            {errors.cedula ? <p role="alert" className="text-sm font-medium text-danger">{errors.cedula.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pr-fecha" className="text-base font-medium">Nueva fecha límite</label>
            <Input id="pr-fecha" type="datetime-local" aria-invalid={errors.nuevaFechaLimite ? true : undefined} {...register("nuevaFechaLimite")} />
            {errors.nuevaFechaLimite ? <p role="alert" className="text-sm font-medium text-danger">{errors.nuevaFechaLimite.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pr-motivo" className="text-base font-medium">Motivo</label>
            <Textarea id="pr-motivo" rows={3} className="resize-none" aria-invalid={errors.motivo ? true : undefined} {...register("motivo")} />
            {errors.motivo ? <p role="alert" className="text-sm font-medium text-danger">{errors.motivo.message}</p> : null}
          </div>
          <Button type="submit" className="min-h-11 w-fit" disabled={pendiente}>
            {pendiente ? "Concediendo…" : "Conceder prórroga"}
          </Button>
        </form>
        <section aria-labelledby="pr-historial" aria-live="polite" className="flex flex-col gap-2">
          <h3 id="pr-historial" className="text-base font-semibold">Historial</h3>
          {historial.isLoading ? <VistaCargando mensaje="Cargando historial…" /> : null}
          {historial.error ? <VistaError mensaje="No se pudo cargar el historial." onReintentar={() => historial.mutate()} /> : null}
          {historial.data && historial.data.length === 0 ? <VistaVacia titulo="Sin prórrogas" /> : null}
          <ul className="flex flex-col gap-2">
            {historial.data?.map((p) => (
              <li key={p.id} className="rounded-md border bg-card p-3 text-base">
                <p className="font-medium">
                  {p.general ? "General" : `Individual · ${p.cedula}`} · hasta {formatearFechaHora(p.nuevaFechaLimite)}
                </p>
                <p className="break-words">{p.motivo}</p>
                <p className="text-sm text-muted-foreground">Concedida por {p.concedidaPor}</p>
              </li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
