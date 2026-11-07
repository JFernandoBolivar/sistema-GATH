"use client";

/**
 * Diálogo consolidado de alta/edición de un rol — paridad funcional con el
 * legado (`gestionar-roles/registrar/page.tsx` + `tableRole/edit-role.tsx`),
 * que vivían como dos formularios casi idénticos en rutas/lugares separados.
 * Aquí es un único diálogo reutilizado tanto desde el botón "Nuevo rol" del
 * toolbar como desde "Editar" en el menú de la fila.
 */
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

import type { RolDTO } from "../application/dtos/usuario-dto";
import { actualizarRolAction, crearRolAction } from "../infrastructure/actions/usuario-actions";
import { rolSchema, type RolFormType } from "./schema/schema-usuario";

interface RolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rolEditando: RolDTO | null;
  onGuardado: () => void;
}

export default function RolDialog({ open, onOpenChange, rolEditando, onGuardado }: RolDialogProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<RolFormType>({
    resolver: zodResolver(rolSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nombreVisible: rolEditando?.nombreVisible ?? "",
        descripcionRol: rolEditando?.descripcionRol ?? "",
      });
    }
  }, [open, rolEditando, form]);

  const onSubmit = (data: RolFormType) => {
    startTransition(async () => {
      const resultado = rolEditando
        ? await actualizarRolAction(rolEditando.id, { nombreVisible: data.nombreVisible, descripcionRol: data.descripcionRol ?? "" })
        : await crearRolAction({ nombreVisible: data.nombreVisible, descripcionRol: data.descripcionRol ?? "" });
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        const err = resultado as { error: string; errores?: Record<string, string[]> };
        const sinUbicar = aplicarErroresServidor(form, err.errores, { nombre: "nombreVisible", nombre_visible: "nombreVisible", nombre_rol: "nombreVisible", descripcion: "descripcionRol", descripcion_rol: "descripcionRol" });
        toast.error(sinUbicar.length > 0 || !err.errores ? err.error : "Revise los campos marcados en rojo.");
        return;
      }
      toast.success(rolEditando ? "Rol actualizado correctamente." : "Rol creado correctamente.");
      onOpenChange(false);
      onGuardado();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{rolEditando ? "Editar rol" : "Nuevo rol"}</DialogTitle>
          <DialogDescription>
            {rolEditando
              ? "Cambiar el nombre no afecta los permisos ni el acceso: el código interno del rol no cambia."
              : "Escriba el nombre que verán los usuarios. El sistema genera el código interno una sola vez."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field data-invalid={!!form.formState.errors.nombreVisible}>
            <Label htmlFor="nombreVisible">Nombre</Label>
            <Input
              id="nombreVisible"
              placeholder="Ej. Jefe de Recepción"
              minLength={2}
              maxLength={100}
              {...form.register("nombreVisible")}
              aria-invalid={!!form.formState.errors.nombreVisible}
            />
            {form.formState.errors.nombreVisible && (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.nombreVisible.message}
              </p>
            )}
          </Field>
          <Field data-invalid={!!form.formState.errors.descripcionRol}>
            <Label htmlFor="descripcionRol">Descripción</Label>
            <Input
              id="descripcionRol"
              maxLength={500}
              {...form.register("descripcionRol")}
              aria-invalid={!!form.formState.errors.descripcionRol}
            />
            {form.formState.errors.descripcionRol && (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.descripcionRol.message}
              </p>
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {rolEditando ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
