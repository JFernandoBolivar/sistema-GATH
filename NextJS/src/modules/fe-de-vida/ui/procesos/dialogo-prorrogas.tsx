"use client";

import { ContadorCampo } from "@/components/contador-caracteres";
import { LIMITES_TEXTO } from "@/shared/validation/limites-texto";
import { useState, useTransition } from "react";
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
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { Textarea } from "@/shared/ui/components/textarea";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import type { ProcesoDTO, ProrrogaDTO } from "../../application/dtos/fe-de-vida-dto";
import {
  extenderProrrogaAction,
  listarProrrogasAction,
  prorrogarProcesoAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { formatearFechaHora } from "../comun/formato";
import {
  extenderProrrogaSchema,
  prorrogaSchema,
  type ExtenderProrrogaValores,
  type ProrrogaValores,
} from "../schema/schema-fe-de-vida";

const TONO_ESTADO = {
  VIGENTE: "success",
  REEMPLAZADA: "neutral",
  VENCIDA: "warning",
} as const;

const ETIQUETA_ESTADO = {
  VIGENTE: "Vigente",
  REEMPLAZADA: "Reemplazada",
  VENCIDA: "Vencida",
} as const;

/** Prórroga individual (con cédula) o general (sin cédula) y su historial por proceso. */
export function DialogoProrrogas({
  proceso,
  onCerrar,
  onCambio,
}: {
  proceso: ProcesoDTO;
  onCerrar: () => void;
  /** Avisa a la ficha del proceso para refrescar el resumen de prórrogas. */
  onCambio?: () => void;
}) {
  const [pendiente, iniciar] = useTransition();
  const [pendienteExtension, iniciarExtension] = useTransition();
  const [extendiendo, setExtendiendo] = useState<ProrrogaDTO | null>(null);
  const historial = useSWR(["fe-de-vida-prorrogas", proceso.id], async () => {
    const res = await listarProrrogasAction(proceso.id);
    if (!res.ok) throw new Error(res.mensaje);
    return res.datos;
  });
  const form = useForm<ProrrogaValores>({
    resolver: zodResolver(prorrogaSchema),
    defaultValues: { cedula: "", nuevaFechaLimite: "", motivo: "" },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const extForm = useForm<ExtenderProrrogaValores>({
    resolver: zodResolver(extenderProrrogaSchema),
    defaultValues: { nuevaFechaLimite: "", motivo: "" },
  });
  const {
    register: registerExt,
    handleSubmit: handleSubmitExt,
    reset: resetExt,
    formState: { errors: errorsExt },
  } = extForm;

  function conceder(v: ProrrogaValores) {
    iniciar(async () => {
      const res = await prorrogarProcesoAction(proceso.id, {
        nuevaFechaLimite: v.nuevaFechaLimite,
        motivo: v.motivo,
        cedula: v.cedula || undefined,
      });
      if (!res.ok) {
        toast.error(res.mensaje);
        if (res.errores) {
          aplicarErroresServidor(form, res.errores, {
            nueva_fecha_limite: "nuevaFechaLimite",
            motivo: "motivo",
            cedula: "cedula",
          });
        }
        return;
      }
      toast.success(res.mensaje);
      reset();
      void historial.mutate();
      onCambio?.();
    });
  }

  function abrirExtension(p: ProrrogaDTO) {
    setExtendiendo(p);
    resetExt({ nuevaFechaLimite: "", motivo: "" });
  }

  function extender(v: ExtenderProrrogaValores) {
    if (!extendiendo) return;
    iniciarExtension(async () => {
      const res = await extenderProrrogaAction(proceso.id, extendiendo.id, {
        nuevaFechaLimite: v.nuevaFechaLimite,
        motivo: v.motivo,
      });
      if (!res.ok) {
        toast.error(res.mensaje);
        if (res.errores) {
          aplicarErroresServidor(extForm, res.errores, {
            nueva_fecha_limite: "nuevaFechaLimite",
            motivo: "motivo",
          });
        }
        return;
      }
      toast.success(res.mensaje);
      setExtendiendo(null);
      resetExt();
      void historial.mutate();
      onCambio?.();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Prórrogas de «{proceso.nombre}»</DialogTitle>
          <DialogDescription>
            Solo puede haber una prórroga vigente por alcance: una general o una por cédula. Para ampliar
            el plazo de una vigente, use «Extender».
          </DialogDescription>
        </DialogHeader>

        {extendiendo ? (
          <form
            noValidate
            onSubmit={handleSubmitExt(extender)}
            className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
          >
            <div>
              <p className="font-semibold">
                Extender prórroga {extendiendo.general ? "general" : `individual · ${extendiendo.cedula}`}
              </p>
              <p className="text-sm text-muted-foreground">
                Vigente hasta {formatearFechaHora(extendiendo.nuevaFechaLimite)}. La anterior quedará en el
                historial como reemplazada.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ext-fecha" className="text-base font-medium">Nueva fecha límite</label>
              <Input id="ext-fecha" type="datetime-local" maxLength={35} aria-invalid={errorsExt.nuevaFechaLimite ? true : undefined} {...registerExt("nuevaFechaLimite")} />
              {errorsExt.nuevaFechaLimite ? <p role="alert" className="text-sm font-medium text-danger">{errorsExt.nuevaFechaLimite.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ext-motivo" className="text-base font-medium">Motivo de la extensión</label>
              <Textarea id="ext-motivo" rows={3} maxLength={LIMITES_TEXTO.motivo.max} mostrarContador={false} className="resize-none" aria-invalid={errorsExt.motivo ? true : undefined} {...registerExt("motivo")} />
              <ContadorCampo control={extForm.control} name="motivo" max={LIMITES_TEXTO.motivo.max} />
              {errorsExt.motivo ? <p role="alert" className="text-sm font-medium text-danger">{errorsExt.motivo.message}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="min-h-11" disabled={pendienteExtension}>
                {pendienteExtension ? "Extendiendo…" : "Extender prórroga"}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setExtendiendo(null)} disabled={pendienteExtension}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}

        <form noValidate onSubmit={handleSubmit(conceder)} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Nueva prórroga. Si ya existe una vigente del mismo alcance, el sistema pedirá extenderla.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pr-cedula" className="text-base font-medium">Cédula (opcional)</label>
            <Input id="pr-cedula" inputMode="numeric" autoComplete="off" maxLength={10} aria-invalid={errors.cedula ? true : undefined} {...register("cedula")} />
            {errors.cedula ? <p role="alert" className="text-sm font-medium text-danger">{errors.cedula.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pr-fecha" className="text-base font-medium">Nueva fecha límite</label>
            <Input id="pr-fecha" type="datetime-local" maxLength={35} aria-invalid={errors.nuevaFechaLimite ? true : undefined} {...register("nuevaFechaLimite")} />
            {errors.nuevaFechaLimite ? <p role="alert" className="text-sm font-medium text-danger">{errors.nuevaFechaLimite.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pr-motivo" className="text-base font-medium">Motivo</label>
            <Textarea id="pr-motivo" rows={3} maxLength={LIMITES_TEXTO.motivo.max} mostrarContador={false} className="resize-none" aria-invalid={errors.motivo ? true : undefined} {...register("motivo")} />
            <ContadorCampo control={form.control} name="motivo" max={LIMITES_TEXTO.motivo.max} />
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {p.general ? "General" : `Individual · ${p.cedula}`} · hasta {formatearFechaHora(p.nuevaFechaLimite)}
                  </p>
                  <StatusBadge texto={ETIQUETA_ESTADO[p.estado]} tono={TONO_ESTADO[p.estado]} />
                </div>
                <p className="break-words">{p.motivo}</p>
                <p className="text-sm text-muted-foreground">Concedida por {p.concedidaPor}</p>
                {p.estado === "VIGENTE" ? (
                  <Button type="button" variant="outline" size="sm" className="mt-2 min-h-10" onClick={() => abrirExtension(p)}>
                    Extender
                  </Button>
                ) : null}
                {p.estado === "REEMPLAZADA" ? (
                  <p className="mt-1 text-sm text-muted-foreground">Reemplazada por una prórroga posterior.</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
