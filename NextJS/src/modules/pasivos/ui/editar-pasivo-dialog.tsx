"use client";

/**
 * Edición de los datos básicos permitidos de un pasivo (`pasivos.editar`).
 * El backend valida el permiso y vuelve a validar cada campo; aquí solo se
 * editan datos de contacto/identidad, nunca el cargo ni la nómina.
 */
import { useEffect, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import {
  ETIQUETA_CODIGO_CARNET_PATRIA,
  ETIQUETA_SERIAL_CARNET_PATRIA,
} from "@/shared/domain/etiquetas-carnet-patria";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { CampoTelefono } from "@/shared/ui/components/campo-telefono";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import type { PasivoDTO } from "../application/dtos/pasivos-dto";
import { actualizarPasivoAction } from "../infrastructure/actions/pasivos-actions";
import { actualizarPasivoSchema, type ActualizarPasivoFormType } from "./schema/schema-pasivo";

interface EditarPasivoDialogProps {
  pasivo: PasivoDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGuardado: (pasivo: PasivoDTO) => void;
}

const VACIOS: ActualizarPasivoFormType = {
  nombres: "",
  apellidos: "",
  correo: null,
  correoAlternativo: null,
  telefonoMovil: null,
  telefonoHabitacion: null,
  carnetPatria: null,
  carnetPatriaSerial: null,
  fechaNacimiento: null,
};

export function EditarPasivoDialog({
  pasivo,
  open,
  onOpenChange,
  onGuardado,
}: EditarPasivoDialogProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<ActualizarPasivoFormType>({
    resolver: zodResolver(actualizarPasivoSchema),
    defaultValues: VACIOS,
  });

  useEffect(() => {
    if (!pasivo) return;
    form.reset({
      nombres: pasivo.nombres,
      apellidos: pasivo.apellidos,
      correo: pasivo.correo,
      correoAlternativo: pasivo.correoAlternativo,
      telefonoMovil: pasivo.telefonoMovil,
      telefonoHabitacion: pasivo.telefonoHabitacion,
      carnetPatria: pasivo.carnetPatria,
      carnetPatriaSerial: pasivo.carnetPatriaSerial,
      fechaNacimiento: pasivo.fechaNacimiento,
    });
  }, [pasivo, form]);

  const onSubmit = (datos: ActualizarPasivoFormType) => {
    if (!pasivo) return;
    startTransition(async () => {
      const resultado = await actualizarPasivoAction(pasivo.cedula, datos);
      if (!resultado || typeof resultado !== "object" || "error" in resultado) {
        const err = resultado as { error?: string; errores?: Record<string, string[]> } | undefined;
        const sinUbicar = aplicarErroresServidor(form, err?.errores);
        toast.error(
          sinUbicar.length > 0 || !err?.errores
            ? (err?.error ?? "No fue posible actualizar los datos del pasivo.")
            : "Revise los campos marcados en rojo.",
        );
        return;
      }
      toast.success("Datos del pasivo actualizados.");
      onGuardado(resultado as PasivoDTO);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Editar datos del pasivo</DialogTitle>
          <DialogDescription>
            {pasivo
              ? `Cédula ${pasivo.cedula}. Solo se modifican datos de identidad y contacto.`
              : "Seleccione un pasivo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!form.formState.errors.nombres}>
              <Label htmlFor="edit-nombres">Nombres *</Label>
              <Input id="edit-nombres" {...form.register("nombres")} />
              {form.formState.errors.nombres && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.nombres.message}
                </p>
              )}
            </Field>
            <Field data-invalid={!!form.formState.errors.apellidos}>
              <Label htmlFor="edit-apellidos">Apellidos *</Label>
              <Input id="edit-apellidos" {...form.register("apellidos")} />
              {form.formState.errors.apellidos && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.apellidos.message}
                </p>
              )}
            </Field>
            <Field data-invalid={!!form.formState.errors.correo}>
              <Label htmlFor="edit-correo">Correo principal</Label>
              <Input id="edit-correo" type="email" {...form.register("correo")} />
              {form.formState.errors.correo && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.correo.message}
                </p>
              )}
            </Field>
            <Field data-invalid={!!form.formState.errors.correoAlternativo}>
              <Label htmlFor="edit-correo-alternativo">Correo alternativo</Label>
              <Input
                id="edit-correo-alternativo"
                type="email"
                {...form.register("correoAlternativo")}
              />
              {form.formState.errors.correoAlternativo && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.correoAlternativo.message}
                </p>
              )}
            </Field>
            <Field>
              <Label htmlFor="edit-carnet">{ETIQUETA_CODIGO_CARNET_PATRIA}</Label>
              <Input id="edit-carnet" {...form.register("carnetPatria")} />
            </Field>
            <Field data-invalid={!!form.formState.errors.carnetPatriaSerial}>
              <Label htmlFor="edit-carnet-serial">{ETIQUETA_SERIAL_CARNET_PATRIA}</Label>
              <Input
                id="edit-carnet-serial"
                placeholder="Serial"
                {...form.register("carnetPatriaSerial")}
              />
              {form.formState.errors.carnetPatriaSerial && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.carnetPatriaSerial.message}
                </p>
              )}
            </Field>
            <Field data-invalid={!!form.formState.errors.telefonoMovil}>
              <Label htmlFor="edit-movil">Teléfono móvil</Label>
              <Controller
                control={form.control}
                name="telefonoMovil"
                render={({ field }) => (
                  <CampoTelefono
                    tipo="movil"
                    id="edit-movil"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalido={!!form.formState.errors.telefonoMovil}
                  />
                )}
              />
              {form.formState.errors.telefonoMovil && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.telefonoMovil.message}
                </p>
              )}
            </Field>
            <Field data-invalid={!!form.formState.errors.telefonoHabitacion}>
              <Label htmlFor="edit-habitacion">Teléfono de habitación</Label>
              <Controller
                control={form.control}
                name="telefonoHabitacion"
                render={({ field }) => (
                  <CampoTelefono
                    id="edit-habitacion"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalido={!!form.formState.errors.telefonoHabitacion}
                  />
                )}
              />
              {form.formState.errors.telefonoHabitacion && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.telefonoHabitacion.message}
                </p>
              )}
            </Field>
            <Field>
              <Label htmlFor="edit-nacimiento">Fecha de nacimiento</Label>
              <Input id="edit-nacimiento" type="date" {...form.register("fechaNacimiento")} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !pasivo}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
