"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import type { SolicitudDetalleDTO } from "../../application/dtos/solicitud-dto";
import { nombreSeccion } from "../../domain/value-objects/campos-seccion";
import {
  habilitarVentanaAction,
  prorrogarVentanaAction,
  rechazarSolicitudAction,
} from "../../infrastructure/actions/solicitudes-actions";
import {
  habilitarVentanaSchema,
  prorrogaSchema,
  rechazoSchema,
  type HabilitarVentanaValores,
  type ProrrogaValores,
  type RechazoValores,
} from "../schema/schema-solicitud";

interface BaseProps {
  solicitud: Pick<SolicitudDetalleDTO, "id" | "seccionesSolicitadas" | "ventanaFin">;
  abierto: boolean;
  onAbiertoChange: (abierto: boolean) => void;
  onHecho: () => void;
}

function MensajeError({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return null;
  return (
    <p id={id} className="text-sm font-medium text-danger">
      {texto}
    </p>
  );
}

/** Habilitar la ventana: plazo en días (1 a 90) y secciones que se abren al trabajador. */
export function DialogoHabilitar({ solicitud, abierto, onAbiertoChange, onHecho }: BaseProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HabilitarVentanaValores>({
    resolver: zodResolver(habilitarVentanaSchema),
    defaultValues: { plazoDias: 15, secciones: solicitud.seccionesSolicitadas },
  });

  async function enviar(v: HabilitarVentanaValores) {
    const res = await habilitarVentanaAction(solicitud.id, {
      plazoDias: v.plazoDias,
      secciones: v.secciones,
    });
    if (res.ok) {
      toast.success(res.mensaje);
      reset();
      onAbiertoChange(false);
      onHecho();
    } else {
      setError("root", { message: res.mensaje });
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Habilitar plazo de actualización</DialogTitle>
          <DialogDescription>
            El trabajador podrá cargar sus cambios y soportes hasta que venza el plazo que indique
            aquí.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plazoDias" className="text-base font-medium">
              Plazo en días (1 a 90)
            </label>
            <Input
              id="plazoDias"
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              aria-invalid={errors.plazoDias ? true : undefined}
              aria-describedby={errors.plazoDias ? "plazo-error" : undefined}
              {...register("plazoDias")}
            />
            <MensajeError id="plazo-error" texto={errors.plazoDias?.message} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-base font-medium">Secciones que se habilitan</legend>
            <Controller
              control={control}
              name="secciones"
              render={({ field }) => (
                <>
                  {solicitud.seccionesSolicitadas.map((codigo) => (
                    <label
                      key={codigo}
                      className="flex min-h-11 cursor-pointer items-center gap-3 text-base"
                    >
                      <Checkbox
                        checked={field.value.includes(codigo)}
                        onCheckedChange={(v) =>
                          field.onChange(
                            v ? [...field.value, codigo] : field.value.filter((x) => x !== codigo),
                          )
                        }
                        className="size-5"
                      />
                      {nombreSeccion(codigo)}
                    </label>
                  ))}
                </>
              )}
            />
            <MensajeError id="secciones-error" texto={errors.secciones?.message} />
          </fieldset>
          <MensajeError id="habilitar-root" texto={errors.root?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onAbiertoChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Habilitando…" : "Habilitar plazo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Prórroga: nueva fecha límite (posterior a hoy) y motivo. Se puede repetir. */
export function DialogoProrrogar({ solicitud, abierto, onAbiertoChange, onHecho }: BaseProps) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProrrogaValores>({
    resolver: zodResolver(prorrogaSchema),
    defaultValues: { nuevaFechaFin: "", motivo: "" },
  });

  async function enviar(v: ProrrogaValores) {
    const res = await prorrogarVentanaAction(solicitud.id, {
      nuevaFechaFin: new Date(v.nuevaFechaFin).toISOString(),
      motivo: v.motivo,
    });
    if (res.ok) {
      toast.success(res.mensaje);
      reset();
      onAbiertoChange(false);
      onHecho();
    } else {
      setError("root", { message: res.mensaje });
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prorrogar el plazo</DialogTitle>
          <DialogDescription>
            Indique la nueva fecha límite (posterior a la vigente) y el motivo de la prórroga.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nuevaFechaFin" className="text-base font-medium">
              Nueva fecha límite
            </label>
            <Input
              id="nuevaFechaFin"
              type="datetime-local"
              aria-invalid={errors.nuevaFechaFin ? true : undefined}
              aria-describedby={errors.nuevaFechaFin ? "fecha-error" : undefined}
              {...register("nuevaFechaFin")}
            />
            <MensajeError id="fecha-error" texto={errors.nuevaFechaFin?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivo-prorroga" className="text-base font-medium">
              Motivo de la prórroga
            </label>
            <Textarea
              id="motivo-prorroga"
              rows={3}
              maxLength={500}
              aria-invalid={errors.motivo ? true : undefined}
              aria-describedby={errors.motivo ? "motivo-prorroga-error" : undefined}
              {...register("motivo")}
            />
            <MensajeError id="motivo-prorroga-error" texto={errors.motivo?.message} />
          </div>
          <MensajeError id="prorroga-root" texto={errors.root?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onAbiertoChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Prorrogando…" : "Prorrogar plazo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Rechazo total de la solicitud, con motivo obligatorio. */
export function DialogoRechazarSolicitud({
  solicitud,
  abierto,
  onAbiertoChange,
  onHecho,
}: BaseProps) {
  const [confirmando, setConfirmando] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<RechazoValores>({
    resolver: zodResolver(rechazoSchema),
    defaultValues: { motivo: "" },
  });

  async function enviar(v: RechazoValores) {
    setConfirmando(true);
    const res = await rechazarSolicitudAction(solicitud.id, v.motivo);
    setConfirmando(false);
    if (res.ok) {
      toast.success(res.mensaje);
      reset();
      onAbiertoChange(false);
      onHecho();
    } else {
      setError("root", { message: res.mensaje });
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onAbiertoChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar la solicitud completa</DialogTitle>
          <DialogDescription>
            No se aplicará ningún cambio a la ficha. El trabajador verá el motivo que escriba.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivo-rechazo" className="text-base font-medium">
              Motivo del rechazo
            </label>
            <Textarea
              id="motivo-rechazo"
              rows={4}
              maxLength={500}
              aria-invalid={errors.motivo ? true : undefined}
              aria-describedby={errors.motivo ? "motivo-rechazo-error" : undefined}
              {...register("motivo")}
            />
            <MensajeError id="motivo-rechazo-error" texto={errors.motivo?.message} />
          </div>
          <MensajeError id="rechazo-root" texto={errors.root?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onAbiertoChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={confirmando}>
              {confirmando ? "Rechazando…" : "Rechazar solicitud"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
