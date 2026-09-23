"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { ArrowBigDownDash, ArrowBigUpDash, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

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

  const { control, register, handleSubmit, setValue, watch, reset } = useForm({
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

      const rawItems = data.antecedentes || [];
      const hasPartial = rawItems.some(
        (a: any) =>
          (a.organismoId || a.fechaIngreso || a.fechaEgreso) &&
          (!a.organismoId || !a.fechaIngreso)
      );
      if (hasPartial) {
        const msg = "Por favor complete el Organismo y la Fecha de Inicio en los antecedentes agregados.";
        setError(msg);
        toast.error(msg);
        return;
      }

      try {
        const payload = {
          antecedentes: rawItems
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
          const msg = (result as { error: string }).error;
          setError(msg);
          toast.error(msg);
          return;
        }

        toast.success("Antecedentes actualizados exitosamente");
        setOpen(false);
        onGuardado();
      } catch {
        const msg = "Error al actualizar los antecedentes.";
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl p-0 border-none bg-transparent shadow-none">
        <DialogTitle className="sr-only">Antecedentes En La Administracion Publica</DialogTitle>

        <Card className="flex flex-col gap-3">
          <CardHeader>
            <CardTitle>Antecedentes En La Administracion Publica</CardTitle>
          </CardHeader>

          <CardContent>
            <CardAction className="text-gray-600">Datos Laborales</CardAction>
          </CardContent>

          <CardContent>
            {error && <p role="alert" className="text-sm text-destructive mb-3">{error}</p>}

            <form className="flex flex-col gap-2" onSubmit={handleSubmit(onSubmit)}>
              <div className="flex justify-end gap-2 mr-4 items-center">
                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="clean" className="text-xs">Limpiar</Label>
                  <Button
                    id="clean"
                    variant="destructive"
                    type="button"
                    size="icon"
                    className="cursor-pointer size-9"
                    onClick={() => {
                      remove(
                        fields
                          .filter((_, idx) => idx !== 0)
                          .map((_, idx) => idx + 1)
                      );
                      reset({
                        antecedentes: [
                          {
                            organismoId: undefined,
                            fechaIngreso: "",
                            fechaEgreso: "",
                          },
                        ],
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="add" className="text-xs">Agregar</Label>
                  <Button
                    id="add"
                    variant="default"
                    type="button"
                    size="icon"
                    className="cursor-pointer size-9"
                    onClick={() => {
                      append({
                        organismoId: undefined,
                        fechaIngreso: "",
                        fechaEgreso: "",
                      });
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-60 rounded-md w-full border p-2">
                <h1 className="text-gray-600 text-sm mb-3">
                  Opcional si no posee antecedentes
                </h1>
                <div className="flex flex-col gap-4">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex flex-wrap gap-3 items-end border-b pb-3 mb-2 w-full"
                    >
                      <div className="w-44">
                        <Label className="flex items-center gap-1">
                          {index + 1}. Fecha Inicio <ArrowBigDownDash className="size-4" />
                        </Label>
                        <Input
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          min="1930-01-01"
                          {...register(`antecedentes.${index}.fechaIngreso` as const)}
                        />
                      </div>

                      <div className="w-44">
                        <Label className="flex items-center gap-1">
                          {index + 1}. Fecha Culminacion <ArrowBigUpDash className="size-4" />
                        </Label>
                        <Input
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          min="1930-01-01"
                          {...register(`antecedentes.${index}.fechaEgreso` as const)}
                        />
                      </div>

                      <div className="flex-1 min-w-[200px]">
                        <Label>Organismo</Label>
                        <Select
                          value={watch(`antecedentes.${index}.organismoId`) ? String(watch(`antecedentes.${index}.organismoId`)) : undefined}
                          onValueChange={(v) => setValue(`antecedentes.${index}.organismoId`, Number(v))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccione un Organismo" />
                          </SelectTrigger>
                          <SelectContent>
                            {(catalogos?.organismos ?? []).map((i) => (
                              <SelectItem key={i.id} value={String(i.id)}>
                                {i.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
