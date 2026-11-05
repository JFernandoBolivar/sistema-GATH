"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { Textarea } from "@/shared/ui/components/textarea";
import { MAX_LONGITUD_MOTIVO } from "../../domain/value-objects/estados";
import {
  devolverSchema,
  retirarCheckSchema,
  textoObligatorioSchema,
  type DevolverValores,
  type RetirarCheckValores,
  type TextoObligatorioValores,
} from "../schema/schema-fe-de-vida";

interface BaseProps {
  abierto: boolean;
  pendiente: boolean;
  onCerrar: () => void;
}

/** Devolver para corrección: motivo obligatorio y casilla «requiere nueva foto». */
export function DialogoDevolver({
  abierto,
  pendiente,
  erroresServidor,
  onCerrar,
  onConfirmar,
}: BaseProps & {
  erroresServidor?: Record<string, string[]>;
  onConfirmar: (motivo: string, requiereNuevaFoto: boolean) => void;
}) {
  const form = useForm<DevolverValores>({
    resolver: zodResolver(devolverSchema),
    defaultValues: { motivo: "", requiereNuevaFoto: false },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (erroresServidor) {
      aplicarErroresServidor(form, erroresServidor);
    }
  }, [erroresServidor, form]);
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <form
          noValidate
          onSubmit={handleSubmit((v) => onConfirmar(v.motivo, v.requiereNuevaFoto))}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Devolver para corrección</DialogTitle>
            <DialogDescription>
              El pasivo verá el motivo y podrá corregir y reenviar. No es un rechazo definitivo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dev-motivo" className="text-base font-medium">
              Motivo
            </label>
            <Textarea
              id="dev-motivo"
              rows={4}
              maxLength={MAX_LONGITUD_MOTIVO}
              className="resize-none"
              aria-invalid={errors.motivo ? true : undefined}
              aria-describedby={errors.motivo ? "dev-motivo-error" : undefined}
              {...register("motivo")}
            />
            {errors.motivo ? (
              <p id="dev-motivo-error" role="alert" className="text-sm font-medium text-danger">
                {errors.motivo.message}
              </p>
            ) : null}
          </div>
          <label className="flex min-h-11 items-center gap-3 text-base">
            <input type="checkbox" className="size-5" {...register("requiereNuevaFoto")} />
            Requiere una foto nueva
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCerrar} disabled={pendiente}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={pendiente}>
              {pendiente ? "Devolviendo…" : "Devolver"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Diálogo con un único texto obligatorio: rechazo (motivo) o aprobación directa (justificación). */
export function DialogoTexto({
  abierto,
  pendiente,
  erroresServidor,
  onCerrar,
  onConfirmar,
  titulo,
  descripcion,
  etiqueta,
  textoBoton,
  destructivo = false,
  aviso,
}: BaseProps & {
  erroresServidor?: Record<string, string[]>;
  onConfirmar: (texto: string) => void;
  titulo: string;
  descripcion: string;
  etiqueta: string;
  textoBoton: string;
  destructivo?: boolean;
  /** Aclaración destacada sobre las consecuencias de la acción. */
  aviso?: ReactNode;
}) {
  const form = useForm<TextoObligatorioValores>({
    resolver: zodResolver(textoObligatorioSchema(etiqueta)),
    defaultValues: { texto: "" },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (erroresServidor) {
      aplicarErroresServidor(form, erroresServidor, {
        motivo: "texto",
        justificacion: "texto",
      });
    }
  }, [erroresServidor, form]);
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <form noValidate onSubmit={handleSubmit((v) => onConfirmar(v.texto))} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{descripcion}</DialogDescription>
          </DialogHeader>
          {aviso ? (
            <div
              role="note"
              className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm text-foreground"
            >
              {aviso}
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dec-texto" className="text-base font-medium">
              {etiqueta}
            </label>
            <Textarea
              id="dec-texto"
              rows={4}
              maxLength={MAX_LONGITUD_MOTIVO}
              className="resize-none"
              aria-invalid={errors.texto ? true : undefined}
              aria-describedby={errors.texto ? "dec-texto-error" : undefined}
              {...register("texto")}
            />
            {errors.texto ? (
              <p id="dec-texto-error" role="alert" className="text-sm font-medium text-danger">
                {errors.texto.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCerrar} disabled={pendiente}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="min-h-11"
              variant={destructivo ? "destructive" : "default"}
              disabled={pendiente}
            >
              {pendiente ? "Procesando…" : textoBoton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Retirar el check propio: justificación obligatoria con contador de caracteres. */
export function DialogoRetirarCheck({
  abierto,
  pendiente,
  erroresServidor,
  onCerrar,
  onConfirmar,
}: BaseProps & {
  erroresServidor?: Record<string, string[]>;
  onConfirmar: (motivo: string) => void;
}) {
  const form = useForm<RetirarCheckValores>({
    resolver: zodResolver(retirarCheckSchema),
    defaultValues: { motivo: "" },
  });
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = form;

  useEffect(() => {
    if (erroresServidor) {
      aplicarErroresServidor(form, erroresServidor, {
        justificacion: "motivo",
      });
    }
  }, [erroresServidor, form]);
  const escritos = useWatch({ control, name: "motivo" })?.length ?? 0;
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <form noValidate onSubmit={handleSubmit((v) => onConfirmar(v.motivo))} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Retirar mi check</DialogTitle>
            <DialogDescription>
              La solicitud volverá a quedar pendiente de revisión y se avisará a Bienestar Social. Quedará
              registrado quién lo retiró y por qué.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ret-motivo" className="text-base font-medium">
              Justificación
            </label>
            <Textarea
              id="ret-motivo"
              rows={4}
              maxLength={MAX_LONGITUD_MOTIVO}
              className="resize-none"
              aria-invalid={errors.motivo ? true : undefined}
              aria-describedby={errors.motivo ? "ret-motivo-error ret-motivo-contador" : "ret-motivo-contador"}
              {...register("motivo")}
            />
            <p id="ret-motivo-contador" className="text-sm text-muted-foreground">
              {escritos} de {MAX_LONGITUD_MOTIVO} caracteres
            </p>
            {errors.motivo ? (
              <p id="ret-motivo-error" role="alert" className="text-sm font-medium text-danger">
                {errors.motivo.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCerrar} disabled={pendiente}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={pendiente}>
              {pendiente ? "Retirando…" : "Retirar check"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Diálogo de confirmación para reenviar constancia */
export function DialogoReenviarConstancia({
  abierto,
  pendiente,
  onCerrar,
  onConfirmar,
}: BaseProps & {
  onConfirmar: () => void;
}) {
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <div className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Reenviar constancia de fe de vida</DialogTitle>
            <DialogDescription>
              Se enviará la constancia validada al correo de acceso del pasivo (y copia a su correo alternativo si es distinto).
              Recuerde que existe un límite de 3 reenvíos por día.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCerrar} disabled={pendiente}>
              Cancelar
            </Button>
            <Button type="button" className="min-h-11" onClick={onConfirmar} disabled={pendiente}>
              {pendiente ? "Reenviando…" : "Reenviar constancia"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Diálogo para regenerar constancia con opción de reenvío */
export function DialogoRegenerarConstancia({
  abierto,
  pendiente,
  onCerrar,
  onConfirmar,
}: BaseProps & {
  onConfirmar: (reenviar: boolean) => void;
}) {
  const [reenviar, setReenviar] = useState(false);

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <div className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Regenerar constancia de fe de vida</DialogTitle>
            <DialogDescription>
              Se regenerará el archivo PDF conservando el mismo número correlativo y código de verificación,
              aplicando la plantilla y URL de verificación vigentes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <input
              type="checkbox"
              id="chk-reenviar"
              className="size-4 rounded border-gray-300"
              checked={reenviar}
              onChange={(e) => setReenviar(e.target.checked)}
              disabled={pendiente}
            />
            <label htmlFor="chk-reenviar" className="text-sm font-medium cursor-pointer">
              Reenviar al correo del pasivo inmediatamente después de regenerar
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCerrar} disabled={pendiente}>
              Cancelar
            </Button>
            <Button type="button" className="min-h-11" onClick={() => onConfirmar(reenviar)} disabled={pendiente}>
              {pendiente ? "Regenerando…" : reenviar ? "Regenerar y reenviar" : "Regenerar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

