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
        nombreRol: rolEditando?.nombreRol ?? "",
        descripcionRol: rolEditando?.descripcionRol ?? "",
      });
    }
  }, [open, rolEditando, form]);

  const onSubmit = (data: RolFormType) => {
    startTransition(async () => {
      const resultado = rolEditando
        ? await actualizarRolAction(rolEditando.id, { nombreRol: data.nombreRol, descripcionRol: data.descripcionRol ?? "" })
        : await crearRolAction({ nombreRol: data.nombreRol, descripcionRol: data.descripcionRol ?? "" });
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error);
        return;
      }
      toast.success(rolEditando ? "Rol actualizado correctamente." : "Rol creado correctamente.");
      onOpenChange(false);
      onGuardado();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rolEditando ? "Editar rol" : "Nuevo rol"}</DialogTitle>
          <DialogDescription>
            {rolEditando
              ? "Si cambia el nombre, el rol deja de coincidir con los permisos configurados en el sistema."
              : "El nombre se guarda en mayúsculas y no puede repetirse."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field data-invalid={!!form.formState.errors.nombreRol}>
            <Label htmlFor="nombreRol">Nombre</Label>
            <Input
              id="nombreRol"
              placeholder="Ej. RECEPCIONISTA"
              {...form.register("nombreRol")}
              aria-invalid={!!form.formState.errors.nombreRol}
            />
            {form.formState.errors.nombreRol && (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.nombreRol.message}
              </p>
            )}
          </Field>
          <Field>
            <Label htmlFor="descripcionRol">Descripción</Label>
            <Input id="descripcionRol" {...form.register("descripcionRol")} />
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
