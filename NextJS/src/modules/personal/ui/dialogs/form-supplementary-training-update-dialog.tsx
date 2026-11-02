"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Loader2, Plus, Trash, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/components/dialog";
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
import { ID_OTRA } from "../catalogo-otra";
import { resolverPendientesOtra, type PendienteOtra } from "../resolver-otra";

interface FormSupplementaryTrainingUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

interface FormacionComplementariaFormItem {
  id?: number;
  capacitacionId?: number;
  institucionId?: number;
  fechaInicio: string;
  fechaFin: string;
  procedenciaId?: number;
  grupoId?: number;
  horasCompletadas: string;
  nuevaCapacitacionNombre: string;
  nuevaInstitucionNombre: string;
}

interface FormSupplementaryTrainingValues {
  formacionComplementaria: FormacionComplementariaFormItem[];
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

  const { control, register, handleSubmit, setValue, watch } =
    useForm<FormSupplementaryTrainingValues>({
      defaultValues: {
        formacionComplementaria:
          (empleado.formacionComplementaria ?? []).length > 0
            ? (empleado.formacionComplementaria ?? []).map((fc) => ({
                id: fc.id,
                capacitacionId: fc.capacitacionId ?? undefined,
                institucionId: fc.institucionId ?? undefined,
                fechaInicio: fc.fechaInicio ?? "",
                fechaFin: fc.fechaFin ?? "",
                procedenciaId: fc.procedenciaId ?? undefined,
                grupoId: fc.grupoId ?? undefined,
                horasCompletadas: fc.horasCompletadas ?? "",
                nuevaCapacitacionNombre: "",
                nuevaInstitucionNombre: "",
              }))
            : [
                {
                  capacitacionId: undefined,
                  institucionId: undefined,
                  fechaInicio: "",
                  fechaFin: "",
                  procedenciaId: undefined,
                  grupoId: undefined,
                  horasCompletadas: "",
                  nuevaCapacitacionNombre: "",
                  nuevaInstitucionNombre: "",
                },
              ],
      },
    });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "formacionComplementaria",
  });

  const onSubmit = (data: FormSupplementaryTrainingValues) => {
    startTransition(async () => {
      setError(null);

      const rawItems = data.formacionComplementaria || [];
      const hasPartial = rawItems.some(
        (fc) =>
          (fc.capacitacionId ||
            fc.institucionId ||
            fc.fechaInicio ||
            fc.fechaFin ||
            fc.horasCompletadas) &&
          (!fc.capacitacionId || !fc.institucionId),
      );
      if (hasPartial) {
        const msg =
          "Por favor complete la Capacitación y la Institución en las capacitaciones agregadas.";
        setError(msg);
        toast.error(msg);
        return;
      }

      // Opción "Otra": crear/reutilizar la capacitación o institución nueva antes de guardar.
      const pendientes: PendienteOtra[] = [];
      rawItems.forEach((fc) => {
        if (Number(fc.capacitacionId) === ID_OTRA) {
          pendientes.push({
            solicitud: { tipo: "capacitaciones", nombre: fc.nuevaCapacitacionNombre ?? "" },
            faltaNombre: "Debe escribir el nombre de la nueva capacitación",
            asignar: (id) => (fc.capacitacionId = id),
          });
        }
        if (Number(fc.institucionId) === ID_OTRA) {
          pendientes.push({
            solicitud: { tipo: "instituciones", nombre: fc.nuevaInstitucionNombre ?? "" },
            faltaNombre: "Debe escribir el nombre de la nueva institución",
            asignar: (id) => (fc.institucionId = id),
          });
        }
      });
      const errorOtra = await resolverPendientesOtra(pendientes);
      if (errorOtra) {
        setError(errorOtra);
        toast.error(errorOtra);
        return;
      }

      try {
        const payload = {
          formacionComplementaria: rawItems
            .filter((fc) => fc.capacitacionId && fc.institucionId)
            .map((fc) => ({
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
          const msg = (result as { error: string }).error;
          setError(msg);
          toast.error(msg);
          return;
        }

        toast.success("Formación complementaria actualizada exitosamente");
        setOpen(false);
        onGuardado();
      } catch {
        const msg = "Error al actualizar la formación complementaria.";
        setError(msg);
        toast.error(msg);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl p-0">
        <DialogTitle className="sr-only">Actualizar Formación Complementaria</DialogTitle>

        <Card className="w-full h-full border-0 shadow-none flex flex-col gap-3">
          <CardHeader>
            <CardTitle>Formación Complementaria</CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <CardAction className="text-gray-600 mb-3">
              Datos De Formación Complementaria
            </CardAction>

            {error && (
              <p role="alert" className="text-sm text-destructive mb-3">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
              <div className="flex justify-end gap-2 mr-4 items-center">
                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="clean" className="text-xs mb-1">
                    Limpiar
                  </Label>
                  <Button
                    id="clean"
                    variant="destructive"
                    type="button"
                    size="icon"
                    className="cursor-pointer size-8"
                    onClick={() => {
                      remove(fields.filter((_, i) => i !== 0).map((_, i) => i + 1));
                      setValue("formacionComplementaria", [
                        {
                          capacitacionId: undefined,
                          institucionId: undefined,
                          fechaInicio: "",
                          fechaFin: "",
                          procedenciaId: undefined,
                          grupoId: undefined,
                          horasCompletadas: "",
                          nuevaCapacitacionNombre: "",
                          nuevaInstitucionNombre: "",
                        },
                      ]);
                    }}
                  >
                    <Trash className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="add" className="text-xs mb-1">
                    Agregar
                  </Label>
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
                        nuevaCapacitacionNombre: "",
                        nuevaInstitucionNombre: "",
                      })
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto rounded-md w-full border p-3">
                <h1 className="text-gray-600 text-sm mb-3">
                  Opcional si no posee formación complementaria
                </h1>
                <div className="flex flex-col gap-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[140px_140px_1fr_1fr_120px_80px_auto] gap-2 items-start border-b pb-3 mb-2 w-full"
                    >
                      <div>
                        <Label className="text-xs">{index + 1}. Fecha Inicio</Label>
                        <Input
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          min="1930-01-01"
                          className="h-9 text-xs"
                          {...register(`formacionComplementaria.${index}.fechaInicio` as const)}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">{index + 1}. Fecha Culminacion</Label>
                        <Input
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          min="1930-01-01"
                          className="h-9 text-xs"
                          {...register(`formacionComplementaria.${index}.fechaFin` as const)}
                        />
                      </div>

                      <div className="min-w-0">
                        <Label className="text-xs">Capacitación</Label>
                        <Select
                          value={
                            watch(`formacionComplementaria.${index}.capacitacionId`)
                              ? String(watch(`formacionComplementaria.${index}.capacitacionId`))
                              : undefined
                          }
                          onValueChange={(v) =>
                            setValue(`formacionComplementaria.${index}.capacitacionId`, Number(v))
                          }
                        >
                          <SelectTrigger className="w-full h-9 text-xs">
                            <SelectValue placeholder="Seleccione" />
                          </SelectTrigger>
                          <SelectContent>
                            {(catalogos?.capacitaciones ?? []).map((cap) => (
                              <SelectItem key={cap.id} value={String(cap.id)}>
                                {cap.nombre}
                              </SelectItem>
                            ))}
                            <SelectItem value={String(ID_OTRA)}>Otra</SelectItem>
                          </SelectContent>
                        </Select>
                        {Number(watch(`formacionComplementaria.${index}.capacitacionId`)) ===
                          ID_OTRA && (
                          <Input
                            className="mt-1 h-8 text-xs"
                            placeholder="Nueva capacitación..."
                            {...register(
                              `formacionComplementaria.${index}.nuevaCapacitacionNombre`,
                            )}
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <Label className="text-xs">Institución</Label>
                        <Select
                          value={
                            watch(`formacionComplementaria.${index}.institucionId`)
                              ? String(watch(`formacionComplementaria.${index}.institucionId`))
                              : undefined
                          }
                          onValueChange={(v) =>
                            setValue(`formacionComplementaria.${index}.institucionId`, Number(v))
                          }
                        >
                          <SelectTrigger className="w-full h-9 text-xs">
                            <SelectValue placeholder="Seleccione" />
                          </SelectTrigger>
                          <SelectContent>
                            {(catalogos?.instituciones ?? []).map((inst) => (
                              <SelectItem key={inst.id} value={String(inst.id)}>
                                {inst.nombre}
                              </SelectItem>
                            ))}
                            <SelectItem value={String(ID_OTRA)}>Otra</SelectItem>
                          </SelectContent>
                        </Select>
                        {Number(watch(`formacionComplementaria.${index}.institucionId`)) ===
                          ID_OTRA && (
                          <Input
                            className="mt-1 h-8 text-xs"
                            placeholder="Nueva institución..."
                            {...register(`formacionComplementaria.${index}.nuevaInstitucionNombre`)}
                          />
                        )}
                      </div>

                      <div>
                        <Label className="text-xs">Procedencia</Label>
                        <Select
                          value={
                            watch(`formacionComplementaria.${index}.procedenciaId`)
                              ? String(watch(`formacionComplementaria.${index}.procedenciaId`))
                              : undefined
                          }
                          onValueChange={(v) =>
                            setValue(`formacionComplementaria.${index}.procedenciaId`, Number(v))
                          }
                        >
                          <SelectTrigger className="w-full h-9 text-xs">
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

                      <div>
                        <Label className="text-xs">Horas</Label>
                        <Input
                          placeholder="40"
                          className="h-9 text-xs"
                          {...register(
                            `formacionComplementaria.${index}.horasCompletadas` as const,
                          )}
                        />
                      </div>

                      <div className="pt-5 flex justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className={`${index === 0 ? "invisible" : ""} cursor-pointer size-8 shrink-0`}
                          onClick={() => remove(index)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button className="mt-4 w-full cursor-pointer" disabled={isPending}>
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
