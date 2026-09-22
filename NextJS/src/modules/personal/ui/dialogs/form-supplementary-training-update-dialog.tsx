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

interface FormSupplementaryTrainingUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function FormSupplementaryTrainingUpdateDialog({
  empleado,
  catalogos,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar",
}: FormSupplementaryTrainingUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { control, register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      formacionComplementaria: (empleado.formacionComplementaria ?? []).length > 0
        ? (empleado.formacionComplementaria ?? []).map((fc) => ({
            id: fc.id,
            capacitacionId: fc.capacitacionId ?? undefined,
            institucionId: fc.institucionId ?? undefined,
            fechaInicio: fc.fechaInicio ?? "",
            fechaFin: fc.fechaFin ?? "",
            procedenciaId: fc.procedenciaId ?? undefined,
            grupoId: fc.grupoId ?? undefined,
            horasCompletadas: fc.horasCompletadas ?? "",
          }))
        : [{ capacitacionId: undefined, institucionId: undefined, fechaInicio: "", fechaFin: "", procedenciaId: undefined, grupoId: undefined, horasCompletadas: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "formacionComplementaria",
  });

  const onSubmit = (data: any) => {
    startTransition(async () => {
      setError(null);
      try {
        const payload = {
          formacionComplementaria: (data.formacionComplementaria || [])
            .filter((fc: any) => fc.capacitacionId && fc.institucionId)
            .map((fc: any) => ({
              id: fc.id,
              capacitacionId: Number(fc.capacitacionId),
              institucionId: Number(fc.institucionId),
              fechaInicio: fc.fechaInicio || null,
              fechaFin: fc.fechaFin || null,
              procedenciaId: fc.procedenciaId ? Number(fc.procedenciaId) : null,
              grupoId: fc.grupoId ? Number(fc.grupoId) : null,
              horasCompletadas: fc.horasCompletadas || null,
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
        setError("Error al actualizar la formación complementaria.");
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
          <DialogTitle>Actualizar Formación Complementaria</DialogTitle>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-md p-3 relative flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Capacitación #{index + 1}</span>
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
                    <Label>Capacitación / Curso *</Label>
                    <Select
                      value={watch(`formacionComplementaria.${index}.capacitacionId`) ? String(watch(`formacionComplementaria.${index}.capacitacionId`)) : undefined}
                      onValueChange={(v) => setValue(`formacionComplementaria.${index}.capacitacionId`, Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione capacitación" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.capacitaciones ?? []).map((cap) => (
                          <SelectItem key={cap.id} value={String(cap.id)}>
                            {cap.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Institución *</Label>
                    <Select
                      value={watch(`formacionComplementaria.${index}.institucionId`) ? String(watch(`formacionComplementaria.${index}.institucionId`)) : undefined}
                      onValueChange={(v) => setValue(`formacionComplementaria.${index}.institucionId`, Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione institución" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.instituciones ?? []).map((inst) => (
                          <SelectItem key={inst.id} value={String(inst.id)}>
                            {inst.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Fecha de Inicio</Label>
                    <Input
                      type="date"
                      {...register(`formacionComplementaria.${index}.fechaInicio` as const)}
                    />
                  </div>
                  <div>
                    <Label>Fecha de Fin</Label>
                    <Input
                      type="date"
                      {...register(`formacionComplementaria.${index}.fechaFin` as const)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Procedencia</Label>
                    <Select
                      value={watch(`formacionComplementaria.${index}.procedenciaId`) ? String(watch(`formacionComplementaria.${index}.procedenciaId`)) : undefined}
                      onValueChange={(v) => setValue(`formacionComplementaria.${index}.procedenciaId`, Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Procedencia" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.tiposProcedencia ?? []).map((tp) => (
                          <SelectItem key={tp.id} value={String(tp.id)}>
                            {tp.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Grupo</Label>
                    <Select
                      value={watch(`formacionComplementaria.${index}.grupoId`) ? String(watch(`formacionComplementaria.${index}.grupoId`)) : undefined}
                      onValueChange={(v) => setValue(`formacionComplementaria.${index}.grupoId`, Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.gruposCapacitacion ?? []).map((gc) => (
                          <SelectItem key={gc.id} value={String(gc.id)}>
                            {gc.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Horas</Label>
                    <Input
                      placeholder="Ej. 40"
                      {...register(`formacionComplementaria.${index}.horasCompletadas` as const)}
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
            onClick={() => append({ capacitacionId: undefined, institucionId: undefined, fechaInicio: "", fechaFin: "", procedenciaId: undefined, grupoId: undefined, horasCompletadas: "" })}
          >
            <Plus className="size-4 mr-1" /> Agregar otra capacitación
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
