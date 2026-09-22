"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../../application/dtos/empleado-dto";
import { actualizarEmpleadoAction } from "../../infrastructure/actions/personal-actions";

interface FormBackgroundUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function FormBackgroundUpdateDialog({
  empleado,
  catalogos,
  onGuardado,
  triggerClassName = "cursor-pointer",
  triggerLabel = "Agregar Antecedentes",
}: FormBackgroundUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { control, register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      antecedentes: (empleado.antecedentes ?? []).length > 0
        ? (empleado.antecedentes ?? []).map((a) => ({
            id: a.id,
            organismoId: a.organismoId ?? undefined,
            fechaIngreso: a.fechaIngreso ?? "",
            fechaEgreso: a.fechaEgreso ?? "",
          }))
        : [{ organismoId: undefined, fechaIngreso: "", fechaEgreso: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "antecedentes",
  });

  const onSubmit = (data: any) => {
    startTransition(async () => {
      setError(null);
      try {
        const payload = {
          antecedentes: (data.antecedentes || [])
            .filter((a: any) => a.organismoId && a.fechaIngreso)
            .map((a: any) => ({
              id: a.id,
              organismoId: Number(a.organismoId),
              fechaIngreso: a.fechaIngreso,
              fechaEgreso: a.fechaEgreso || null,
            })),
        };

        const result = await actualizarEmpleadoAction(empleado.cedula, payload);
        if (result && typeof result === "object" && "error" in result) {
          setError((result as { error: string }).error);
          return;
        }

        setOpen(false);
        onGuardado();
      } catch {
        setError("Error al actualizar los antecedentes.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Actualizar Antecedentes en la APN</DialogTitle>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-md p-3 relative flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Antecedente #{index + 1}</span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>

                <div>
                  <Label>Institución / Ente *</Label>
                  <Select
                    value={watch(`antecedentes.${index}.organismoId`) ? String(watch(`antecedentes.${index}.organismoId`)) : undefined}
                    onValueChange={(v) => setValue(`antecedentes.${index}.organismoId`, Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione organismo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(catalogos?.organismos ?? []).map((org) => (
                        <SelectItem key={org.id} value={String(org.id)}>
                          {org.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Fecha de Ingreso *</Label>
                    <Input
                      type="date"
                      {...register(`antecedentes.${index}.fechaIngreso` as const, { required: true })}
                    />
                  </div>
                  <div>
                    <Label>Fecha de Egreso (Opcional)</Label>
                    <Input
                      type="date"
                      {...register(`antecedentes.${index}.fechaEgreso` as const)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => append({ organismoId: undefined, fechaIngreso: "", fechaEgreso: "" })}
          >
            <Plus className="size-4 mr-1" /> Agregar otro antecedente
          </Button>

          <div className="flex justify-end gap-2 mt-4 border-t pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin mr-1" />}
              Guardar Cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
