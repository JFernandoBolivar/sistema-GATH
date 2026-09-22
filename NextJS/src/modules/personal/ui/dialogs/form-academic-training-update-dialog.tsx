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

interface FormAcademicTrainingUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function FormAcademicTrainingUpdateDialog({
  empleado,
  catalogos,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar",
}: FormAcademicTrainingUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      formacionAcademica: (empleado.formacionAcademica ?? []).length > 0
        ? (empleado.formacionAcademica ?? []).map((fa) => ({
            id: fa.id,
            nivelAcademicoId: fa.nivelAcademicoId ?? undefined,
            carreraId: fa.carreraId ?? undefined,
            mencionId: fa.mencionId ?? undefined,
            institucionId: fa.institucionId ?? undefined,
          }))
        : [{ nivelAcademicoId: undefined, carreraId: undefined, mencionId: undefined, institucionId: undefined }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "formacionAcademica",
  });

  const onSubmit = (data: any) => {
    startTransition(async () => {
      setError(null);
      try {
        const payload = {
          formacionAcademica: (data.formacionAcademica || [])
            .filter((fa: any) => fa.nivelAcademicoId && fa.institucionId)
            .map((fa: any) => ({
              id: fa.id,
              nivelAcademicoId: Number(fa.nivelAcademicoId),
              carreraId: fa.carreraId ? Number(fa.carreraId) : null,
              mencionId: fa.mencionId ? Number(fa.mencionId) : null,
              institucionId: Number(fa.institucionId),
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
        setError("Error al actualizar la formación académica.");
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
          <DialogTitle>Actualizar Formación Académica</DialogTitle>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-md p-3 relative flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Formación #{index + 1}</span>
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
                    <Label>Nivel Académico *</Label>
                    <Select
                      value={watch(`formacionAcademica.${index}.nivelAcademicoId`) ? String(watch(`formacionAcademica.${index}.nivelAcademicoId`)) : undefined}
                      onValueChange={(v) => setValue(`formacionAcademica.${index}.nivelAcademicoId`, Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione nivel" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.nivelesAcademicos ?? []).map((n) => (
                          <SelectItem key={n.id} value={String(n.id)}>
                            {n.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Institución *</Label>
                    <Select
                      value={watch(`formacionAcademica.${index}.institucionId`) ? String(watch(`formacionAcademica.${index}.institucionId`)) : undefined}
                      onValueChange={(v) => setValue(`formacionAcademica.${index}.institucionId`, Number(v))}
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
                    <Label>Carrera</Label>
                    <Select
                      value={watch(`formacionAcademica.${index}.carreraId`) ? String(watch(`formacionAcademica.${index}.carreraId`)) : undefined}
                      onValueChange={(v) => setValue(`formacionAcademica.${index}.carreraId`, Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione carrera" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.carreras ?? []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Mención</Label>
                    <Select
                      value={watch(`formacionAcademica.${index}.mencionId`) ? String(watch(`formacionAcademica.${index}.mencionId`)) : undefined}
                      onValueChange={(v) => setValue(`formacionAcademica.${index}.mencionId`, Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione mención" />
                      </SelectTrigger>
                      <SelectContent>
                        {(catalogos?.menciones ?? []).map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
            onClick={() => append({ nivelAcademicoId: undefined, carreraId: undefined, mencionId: undefined, institucionId: undefined })}
          >
            <Plus className="size-4 mr-1" /> Agregar otra formación
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
