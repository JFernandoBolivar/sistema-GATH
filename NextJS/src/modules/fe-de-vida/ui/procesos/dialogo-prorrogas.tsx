"use client";

import { ContadorCampo } from "@/components/contador-caracteres";
import { LIMITES_TEXTO } from "@/shared/validation/limites-texto";
import { useEffect, useRef, useState, useTransition } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, CalendarPlus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { ProcesoDTO, ProrrogaDTO } from "../../application/dtos/fe-de-vida-dto";
import {
  extenderProrrogaAction,
  listarProrrogasAction,
  prorrogarProcesoAction,
} from "../../infrastructure/actions/fe-de-vida-actions";
import { aInputLocal, formatearFechaHora } from "../comun/formato";
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

/** Una acción a la vez: el historial, conceder una nueva prórroga o extender una vigente. */
type Vista =
  | { tipo: "historial" }
  | { tipo: "nueva" }
  | { tipo: "extender"; prorroga: ProrrogaDTO };

/**
 * Prórrogas de un proceso (individuales o generales) y su historial.
 * El diálogo trabaja por vistas para que el formulario de extensión nunca quede fuera de la
 * zona visible: se abre una sola cosa a la vez y siempre hay un camino de vuelta al historial.
 */
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
  const [vista, setVista] = useState<Vista>({ tipo: "historial" });
  /** Id de la prórroga recién creada o extendida, para resaltarla al volver al historial. */
  const [resaltada, setResaltada] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const contenidoRef = useRef<HTMLDivElement>(null);
  /** Candado contra dobles envíos por clics repetidos. */
  const enviandoRef = useRef(false);

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
    setError: setErrorExt,
    formState: { errors: errorsExt },
  } = extForm;

  /** Al cambiar de vista, vuelve al inicio del scroll y enfoca el primer campo del formulario. */
  useEffect(() => {
    const raiz = contenidoRef.current;
    if (!raiz) return;
    const viewport = raiz.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (viewport) viewport.scrollTop = 0;
    if (vista.tipo === "extender") raiz.querySelector<HTMLInputElement>("#ext-fecha")?.focus();
    if (vista.tipo === "nueva") raiz.querySelector<HTMLInputElement>("#pr-fecha")?.focus();
  }, [vista]);

  function volverAlHistorial() {
    setVista({ tipo: "historial" });
  }

  function abrirNueva() {
    reset();
    setResaltada(null);
    setVista({ tipo: "nueva" });
  }

  function abrirExtension(p: ProrrogaDTO) {
    resetExt();
    setResaltada(null);
    setVista({ tipo: "extender", prorroga: p });
  }

  function conceder(v: ProrrogaValores) {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    iniciar(async () => {
      try {
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
        setResaltada(res.datos?.id ?? null);
        setAviso("Prórroga concedida. El historial ya la muestra.");
        volverAlHistorial();
      } finally {
        enviandoRef.current = false;
      }
    });
  }

  function extender(v: ExtenderProrrogaValores) {
    if (vista.tipo !== "extender" || enviandoRef.current) return;
    const actual = vista.prorroga.nuevaFechaLimite
      ? new Date(vista.prorroga.nuevaFechaLimite)
      : null;
    const nueva = new Date(v.nuevaFechaLimite);
    if (Number.isNaN(nueva.getTime()) || (actual !== null && nueva <= actual)) {
      setErrorExt(
        "nuevaFechaLimite",
        {
          type: "manual",
          message: `La nueva fecha debe ser posterior al ${formatearFechaHora(vista.prorroga.nuevaFechaLimite)}`,
        },
        { shouldFocus: true },
      );
      return;
    }
    enviandoRef.current = true;
    iniciarExtension(async () => {
      try {
        const res = await extenderProrrogaAction(proceso.id, vista.prorroga.id, {
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
        resetExt();
        void historial.mutate();
        onCambio?.();
        setResaltada(res.datos?.id ?? null);
        setAviso("Prórroga extendida. El historial ya muestra la nueva fecha.");
        volverAlHistorial();
      } finally {
        enviandoRef.current = false;
      }
    });
  }

  const titulo =
    vista.tipo === "historial"
      ? `Prórrogas de «${proceso.nombre}»`
      : vista.tipo === "nueva"
        ? "Nueva prórroga"
        : `Extender prórroga ${vista.prorroga.general ? "general" : `individual · ${vista.prorroga.cedula}`}`;

  const descripcion =
    vista.tipo === "historial"
      ? "Solo puede haber una prórroga vigente por alcance: una general o una por cédula. Para ampliar el plazo de una vigente, use «Extender»."
      : vista.tipo === "nueva"
        ? "Defina el alcance y la nueva fecha límite. Si ya existe una prórroga vigente del mismo alcance, el sistema pedirá extenderla."
        : `Vigente hasta ${formatearFechaHora(vista.prorroga.nuevaFechaLimite)}. Al extenderla, la anterior quedará en el historial como reemplazada.`;

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-hidden">
        <div ref={contenidoRef} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{descripcion}</DialogDescription>
          </DialogHeader>

          <p aria-live="polite" className="sr-only">{aviso}</p>

          {vista.tipo === "historial" ? (
            <Button type="button" className="min-h-11 w-fit" onClick={abrirNueva}>
              <CalendarPlus aria-hidden /> Conceder nueva prórroga
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="-mt-1 min-h-10 w-fit"
              onClick={volverAlHistorial}
              disabled={pendiente || pendienteExtension}
            >
              <ArrowLeft aria-hidden /> Volver al historial
            </Button>
          )}

          {vista.tipo === "nueva" ? (
            <form noValidate onSubmit={handleSubmit(conceder)} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                La cédula es opcional: si la deja vacía, la prórroga será general para todo el proceso.
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
          ) : null}

          {vista.tipo === "extender" ? (
            <>
              <dl className="grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-base sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Alcance</dt>
                  <dd className="font-medium">
                    {vista.prorroga.general ? "General" : `Individual · ${vista.prorroga.cedula}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Vigente hasta</dt>
                  <dd className="font-medium">{formatearFechaHora(vista.prorroga.nuevaFechaLimite)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Concedida por</dt>
                  <dd>{vista.prorroga.concedidaPor}</dd>
                </div>
              </dl>
              <form noValidate onSubmit={handleSubmitExt(extender)} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ext-fecha" className="text-base font-medium">Nueva fecha límite</label>
                  <Input
                    id="ext-fecha"
                    type="datetime-local"
                    maxLength={35}
                    min={aInputLocal(vista.prorroga.nuevaFechaLimite)}
                    aria-invalid={errorsExt.nuevaFechaLimite ? true : undefined}
                    {...registerExt("nuevaFechaLimite")}
                  />
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
                  <Button type="button" variant="outline" className="min-h-11" onClick={volverAlHistorial} disabled={pendienteExtension}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </>
          ) : null}

          {vista.tipo === "historial" ? (
            <section aria-labelledby="pr-historial" aria-live="polite" className="flex flex-col gap-2">
              <h3 id="pr-historial" className="text-base font-semibold">Historial</h3>
              {historial.isLoading ? <VistaCargando mensaje="Cargando historial…" /> : null}
              {historial.error ? <VistaError mensaje="No se pudo cargar el historial." onReintentar={() => historial.mutate()} /> : null}
              {historial.data && historial.data.length === 0 ? (
                <VistaVacia titulo="Sin prórrogas" descripcion="Conceda la primera prórroga con el botón de arriba." />
              ) : null}
              <ul className="flex flex-col gap-2">
                {historial.data?.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "rounded-md border bg-card p-3 text-base",
                      p.id === resaltada && "border-primary ring-2 ring-primary",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {p.general ? "General" : `Individual · ${p.cedula}`} · hasta {formatearFechaHora(p.nuevaFechaLimite)}
                      </p>
                      <StatusBadge texto={ETIQUETA_ESTADO[p.estado]} tono={TONO_ESTADO[p.estado]} />
                    </div>
                    <p className="break-words">{p.motivo}</p>
                    <p className="text-sm text-muted-foreground">Concedida por {p.concedidaPor}</p>
                    {p.estado === "VIGENTE" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 min-h-10"
                        aria-label={`Extender prórroga ${p.general ? "general" : `individual ${p.cedula}`} que vence el ${formatearFechaHora(p.nuevaFechaLimite)}`}
                        onClick={() => abrirExtension(p)}
                      >
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
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
