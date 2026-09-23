"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Loader2, Plus, Trash, X } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { ScrollArea } from "@/shared/ui/components/scroll-area";
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl p-0">
        <DialogTitle className="sr-only">Actualizar Formación Complementaria</DialogTitle>

        <Card className="w-full h-full border-0 shadow-none flex flex-col gap-3">
          <CardHeader>
            <CardTitle>Formación Complementaria</CardTitle>
          </CardHeader>

          <CardContent>
            <CardAction className="text-gray-600 mb-3">
              Datos De Formación Complementaria
            </CardAction>

            {error && <p role="alert" className="text-sm text-destructive mb-3">{error}</p>}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
              <div className="flex justify-end gap-2 mr-4 items-center">
                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="clean" className="text-xs mb-1">Limpiar</Label>
                  <Button
                    id="clean"
                    variant="destructive"
                    type="button"
                    size="icon"
                    className="cursor-pointer size-8"
                    onClick={() => {
                      remove(fields.filter((_, i) => i !== 0).map((_, i) => i + 1));
                      setValue("formacionComplementaria", [
                        { capacitacionId: undefined, institucionId: undefined, fechaInicio: "", fechaFin: "", procedenciaId: undefined, grupoId: undefined, horasCompletadas: "" },
                      ]);
                    }}
                  >
                    <Trash className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="add" className="text-xs mb-1">Agregar</Label>
                  <Button
                    id="add"
                    variant="default"
                    type="button"
                    size="icon"
                    className="cursor-pointer size-8"
                    onClick={() =>
                      append({
                        capacitacionId: undefined,
                        institucionId: undefined,
                        fechaInicio: "",
                        fechaFin: "",
                        procedenciaId: undefined,
                        grupoId: undefined,
                        horasCompletadas: "",
                      })
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-64 rounded-md w-full border p-2">
                <h1 className="text-gray-600 text-sm mb-3">
                  Opcional si no posee formación complementaria
                </h1>
                <div className="flex flex-col gap-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex flex-wrap gap-3 items-end border-b pb-3 mb-2 w-full">
                      <div className="w-40">
                        <Label>{index + 1}. Fecha Inicio</Label>
                        <Input
                          type="date"
                          {...register(`formacionComplementaria.${index}.fechaInicio` as const)}
                        />
                      </div>

                      <div className="w-40">
                        <Label>{index + 1}. Fecha Culminacion</Label>
                        <Input
                          type="date"
                          {...register(`formacionComplementaria.${index}.fechaFin` as const)}
                        />
                      </div>

                      <div className="flex-1 min-w-[150px]">
                        <Label>Capacitación</Label>
                        <Select
                          value={watch(`formacionComplementaria.${index}.capacitacionId`) ? String(watch(`formacionComplementaria.${index}.capacitacionId`)) : undefined}
                          onValueChange={(v) => setValue(`formacionComplementaria.${index}.capacitacionId`, Number(v))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccione" />
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

                      <div className="flex-1 min-w-[150px]">
                        <Label>Institución</Label>
                        <Select
                          value={watch(`formacionComplementaria.${index}.institucionId`) ? String(watch(`formacionComplementaria.${index}.institucionId`)) : undefined}
                          onValueChange={(v) => setValue(`formacionComplementaria.${index}.institucionId`, Number(v))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccione" />
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

                      <div className="w-36">
                        <Label>Procedencia</Label>
                        <Select
                          value={watch(`formacionComplementaria.${index}.procedenciaId`) ? String(watch(`formacionComplementaria.${index}.procedenciaId`)) : undefined}
                          onValueChange={(v) => setValue(`formacionComplementaria.${index}.procedenciaId`, Number(v))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccione" />
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

                      <div className="w-24">
                        <Label>Horas</Label>
                        <Input
                          placeholder="Ej: 40"
                          {...register(`formacionComplementaria.${index}.horasCompletadas` as const)}
                        />
                      </div>

                      <div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className={`${index === 0 ? "invisible" : ""} cursor-pointer size-9 shrink-0`}
                          onClick={() => remove(index)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Button
                className="mt-4 w-full cursor-pointer"
                disabled={isPending}
              >
                {isPending && <Loader2 className="size-4 animate-spin mr-1" />}
                {isPending ? "Actualizando Información" : "Actualizar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
