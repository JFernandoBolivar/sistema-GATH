"use client";

/**
 * Diálogo de edición de un usuario — paridad con el legado
 * (`gestionar-usuarios/modificar/tableUser/detail-info.tsx`, que vivía como
 * diálogo embebido en el menú de acciones de la fila). Un solo diálogo con
 * los tres campos editables (contraseña opcional, departamento, rol), sin
 * fragmentar en pasos.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { DepartamentoDTO, RolDTO, UsuarioDTO } from "../application/dtos/usuario-dto";
import { editarUsuarioAction } from "../infrastructure/actions/usuario-actions";
import { editarUsuarioSchema, type EditarUsuarioFormType } from "./schema/schema-usuario";

interface UsuarioEditarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usuario: UsuarioDTO | null;
  departamentos: DepartamentoDTO[];
  roles: RolDTO[];
  onGuardado: () => void;
}

export default function UsuarioEditarDialog({
  open,
  onOpenChange,
  usuario,
  departamentos,
  roles,
  onGuardado,
}: UsuarioEditarDialogProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<EditarUsuarioFormType>({
    resolver: zodResolver(editarUsuarioSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (open && usuario) {
      form.reset({
        departamentoId: usuario.departamentoId ?? null,
        rolId: usuario.rolId ?? null,
        password: "",
      });
    }
  }, [open, usuario, form]);

  const onSubmit = (data: EditarUsuarioFormType) => {
    if (!usuario) return;
    startTransition(async () => {
      const resultado = await editarUsuarioAction(usuario.id, {
        departamentoId: data.departamentoId ?? null,
        rolId: data.rolId ?? null,
        password: data.password?.trim() ? data.password.trim() : null,
      });
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error);
        return;
      }
      toast.success("Usuario actualizado correctamente.");
      onOpenChange(false);
      onGuardado();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            {usuario ? `Editando la cuenta de ${usuario.cedula}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field data-invalid={!!form.formState.errors.password}>
            <Label htmlFor="editPassword">Nueva contraseña (opcional)</Label>
            <Input
              type="password"
              id="editPassword"
              placeholder="Dejar vacío para no cambiar"
              {...form.register("password")}
              aria-invalid={!!form.formState.errors.password}
            />
            {form.formState.errors.password && (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
          </Field>
          <Field>
            <Label htmlFor="editDepartamento">Departamento</Label>
            <Select
              value={form.watch("departamentoId") ? String(form.watch("departamentoId")) : "__none"}
              onValueChange={(v) => form.setValue("departamentoId", v === "__none" ? null : Number(v))}
            >
              <SelectTrigger id="editDepartamento" className="w-full">
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Sin asignar —</SelectItem>
                {departamentos.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Label htmlFor="editRol">Rol</Label>
            <Select
              value={form.watch("rolId") ? String(form.watch("rolId")) : "__none"}
              onValueChange={(v) => form.setValue("rolId", v === "__none" ? null : Number(v))}
            >
              <SelectTrigger id="editRol" className="w-full">
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Sin asignar —</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.nombreRol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
