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

interface FormContratoUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function FormContratoUpdateDialog({
  empleado,
  catalogos,
  onGuardado,
  triggerClassName = "cursor-pointer",
  triggerLabel = "Agregar Contratos",
}: FormContratoUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialContratos = (empleado.contratos && empleado.contratos.length > 0)
    ? empleado.contratos
    : empleado.contratoActual
    ? [empleado.contratoActual]
    : [];

  const { control, register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      contrato: initialContratos.length > 0
        ? initialContratos.map((c) => ({
            id: c.id,
            nContrato: c.nContrato ?? "",
            fechaIngreso: c.fechaIngreso ?? "",
            fechaCulminacion: c.fechaCulminacion ?? "",
            politicaId: c.politicaId ?? undefined,
            esFijo: c.esFijo ?? false,
          }))
        : [{ nContrato: "", fechaIngreso: "", fechaCulminacion: "", politicaId: undefined, esFijo: false }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "contrato",
  });

  const onSubmit = (data: any) => {
    startTransition(async () => {
      setError(null);
      try {
        const payload = {
          contrato: (data.contrato || [])
            .filter((c: any) => c.fechaIngreso)
            .map((c: any) => ({
              id: c.id,
              nContrato: c.nContrato || null,
              fechaIngreso: c.fechaIngreso,
              fechaCulminacion: c.fechaCulminacion || null,
              politicaId: c.politicaId ? Number(c.politicaId) : null,
              esFijo: !!c.esFijo,
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
        setError("Error al actualizar los contratos.");
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
          <DialogTitle>Gestionar Contratos</DialogTitle>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-md p-3 relative flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Contrato #{index + 1}</span>
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>N° de Contrato</Label>
                    <Input
                      placeholder="Ej. C-2024-001"
                      {...register(`contrato.${index}.nContrato` as const)}
                    />
                  </div>
                  <div>
                    <Label>Política *</Label>
                    <Select
                      value={watch(`contrato.${index}.politicaId`) ? String(watch(`contrato.${index}.politicaId`)) : undefined}
                      onValueChange={(v) => setValue(`contrato.${index}.politicaId`, Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione política" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.politicas ?? []).map((pol) => (
                          <SelectItem key={pol.id} value={String(pol.id)}>
                            {pol.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Fecha de Ingreso *</Label>
                    <Input
                      type="date"
                      {...register(`contrato.${index}.fechaIngreso` as const, { required: true })}
                    />
                  </div>
                  <div>
                    <Label>Fecha de Culminación</Label>
                    <Input
                      type="date"
                      {...register(`contrato.${index}.fechaCulminacion` as const)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`esFijo-${index}`}
                    {...register(`contrato.${index}.esFijo` as const)}
                    className="size-4 rounded"
                  />
                  <Label htmlFor={`esFijo-${index}`} className="cursor-pointer text-xs">
                    ¿Es contrato a tiempo indeterminado / Fijo?
                  </Label>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => append({ nContrato: "", fechaIngreso: "", fechaCulminacion: "", politicaId: undefined, esFijo: false })}
          >
            <Plus className="size-4 mr-1" /> Agregar otro contrato
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
