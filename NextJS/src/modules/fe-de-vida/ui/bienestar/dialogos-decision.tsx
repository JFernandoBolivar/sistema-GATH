"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
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
  textoObligatorioSchema,
  type DevolverValores,
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
  onCerrar,
  onConfirmar,
}: BaseProps & { onConfirmar: (motivo: string, requiereNuevaFoto: boolean) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DevolverValores>({
    resolver: zodResolver(devolverSchema),
    defaultValues: { motivo: "", requiereNuevaFoto: false },
  });
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
  onCerrar,
  onConfirmar,
  titulo,
  descripcion,
  etiqueta,
  textoBoton,
  destructivo = false,
}: BaseProps & {
  onConfirmar: (texto: string) => void;
  titulo: string;
  descripcion: string;
  etiqueta: string;
  textoBoton: string;
  destructivo?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TextoObligatorioValores>({
    resolver: zodResolver(textoObligatorioSchema(etiqueta)),
    defaultValues: { texto: "" },
  });
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent>
        <form noValidate onSubmit={handleSubmit((v) => onConfirmar(v.texto))} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{descripcion}</DialogDescription>
          </DialogHeader>
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
