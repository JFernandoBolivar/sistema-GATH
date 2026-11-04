"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { ArrowBigDownDash, ArrowBigUpDash, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Combobox } from "@/shared/ui/components/combobox";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../../application/dtos/empleado-dto";
import { actualizarEmpleadoAction } from "../../infrastructure/actions/personal-actions";
import { avisoDeFallo, mensajeDe } from "./campo-dialogo";

/** Ruta del API -> campo del formulario. */
const MAPA_ERRORES = {
  antecedentes: "antecedentes",
  organismo: "organismoId",
  fecha_ingreso: "fechaIngreso",
  fecha_egreso: "fechaEgreso",
};

function MensajeFila({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {error}
    </p>
  ) : null;
}

interface FormBackgroundUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

interface AntecedenteFormItem {
  id?: number;
  organismoId?: number;
  fechaIngreso: string;
  fechaEgreso: string;
}

interface FormBackgroundValues {
  antecedentes: AntecedenteFormItem[];
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

  const form = useForm<FormBackgroundValues>(
    {
      defaultValues: {
        antecedentes:
          (empleado.antecedentes ?? []).length > 0
            ? (empleado.antecedentes ?? []).map((a) => ({
                id: a.id,
                organismoId: a.organismoId ?? 0,
                fechaIngreso: a.fechaIngreso ?? "",
                fechaEgreso: a.fechaEgreso ?? "",
              }))
            : [{ organismoId: 0, fechaIngreso: "", fechaEgreso: "" }],
      },
    },
  );

  const { control, register, handleSubmit, setValue, watch, reset } = form;
  const erroresAntecedentes = form.formState.errors.antecedentes;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "antecedentes",
  });

  const onSubmit = (data: FormBackgroundValues) => {
    startTransition(async () => {
      setError(null);

      const rawItems = data.antecedentes || [];
      const hasPartial = rawItems.some(
        (a) =>
          (a.organismoId || a.fechaIngreso || a.fechaEgreso) && (!a.organismoId || !a.fechaIngreso),
      );
      if (hasPartial) {
        const msg =
          "Por favor complete el Organismo y la Fecha de Inicio en los antecedentes agregados.";
        setError(msg);
        toast.error(msg);
        return;
      }

      try {
        const payload = {
          antecedentes: rawItems
            .filter((a) => a.organismoId && a.fechaIngreso)
            .map((a) => ({
              id: a.id,
              organismoId: Number(a.organismoId),
              fechaIngreso: a.fechaIngreso,
              fechaEgreso: a.fechaEgreso || null,
            })),
        };

        const result = await actualizarEmpleadoAction(empleado.cedula, payload);
        if (result && typeof result === "object" && "error" in result) {
          const fallo = result as { error: string; errores?: Record<string, string[]> };
          const sinUbicar = aplicarErroresServidor(form, fallo.errores, MAPA_ERRORES);
          setError(avisoDeFallo(fallo, sinUbicar));
          toast.error(fallo.error);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl p-0">
        <DialogTitle className="sr-only">Antecedentes En La Administracion Publica</DialogTitle>

        <Card className="w-full h-full border-0 shadow-none flex flex-col gap-3">
          <CardHeader>
            <CardTitle>Antecedentes En La Administracion Publica</CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <CardAction className="text-gray-600 mb-3">Datos Laborales</CardAction>

            {error && (
              <p role="alert" className="text-sm text-destructive mb-3">
                {error}
              </p>
            )}

            <form className="flex flex-col gap-2" onSubmit={handleSubmit(onSubmit)}>
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
                      remove(fields.filter((_, idx) => idx !== 0).map((_, idx) => idx + 1));
                      reset({
                        antecedentes: [
                          {
                            organismoId: 0,
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
                  <Label htmlFor="add" className="text-xs mb-1">
                    Agregar
                  </Label>
                  <Button
                    id="add"
                    variant="default"
                    type="button"
                    size="icon"
                    className="cursor-pointer size-8"
                    onClick={() => {
                      append({
                        organismoId: 0,
                        fechaIngreso: "",
                        fechaEgreso: "",
                      });
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto rounded-md w-full border p-3">
                <h1 className="text-gray-600 text-sm mb-3">Opcional si no posee antecedentes</h1>
                <div className="flex flex-col gap-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="@container flex flex-col gap-3 border-b pb-3 mb-2 w-full"
                    >
                      <div className="grid grid-cols-1 items-start gap-3 @md:grid-cols-2">
                        <div className="min-w-0">
                          <Label className="flex items-center gap-1 text-xs">
                            {index + 1}. Fecha Inicio <ArrowBigDownDash className="size-4" />
                          </Label>
                          <Input
                            type="date"
                            max={new Date().toISOString().split("T")[0]}
                            min="1930-01-01"
                            aria-invalid={!!erroresAntecedentes?.[index]?.fechaIngreso || undefined}
                            {...register(`antecedentes.${index}.fechaIngreso` as const)}
                          />
                          <MensajeFila error={mensajeDe(erroresAntecedentes?.[index]?.fechaIngreso)} />
                        </div>

                        <div className="min-w-0">
                          <Label className="flex items-center gap-1 text-xs">
                            {index + 1}. Fecha Culminacion <ArrowBigUpDash className="size-4" />
                          </Label>
                          <Input
                            type="date"
                            max={new Date().toISOString().split("T")[0]}
                            min="1930-01-01"
                            aria-invalid={!!erroresAntecedentes?.[index]?.fechaEgreso || undefined}
                            {...register(`antecedentes.${index}.fechaEgreso` as const)}
                          />
                          <MensajeFila error={mensajeDe(erroresAntecedentes?.[index]?.fechaEgreso)} />
                        </div>
                      </div>

                      <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <Label>Organismo</Label>
                          <Combobox
                            invalido={!!erroresAntecedentes?.[index]?.organismoId}
                            options={(catalogos?.organismos ?? []).map((i) => ({
                              value: String(i.id),
                              label: i.nombre,
                            }))}
                            value={
                              watch(`antecedentes.${index}.organismoId`)
                                ? String(watch(`antecedentes.${index}.organismoId`))
                                : ""
                            }
                            onChange={(v) => setValue(`antecedentes.${index}.organismoId`, Number(v))}
                            placeholder="Seleccione un Organismo"
                            searchPlaceholder="Buscar organismo..."
                          />
                          <MensajeFila error={mensajeDe(erroresAntecedentes?.[index]?.organismoId)} />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className={`${index === 0 ? "invisible" : ""} cursor-pointer size-9 shrink-0`}
                          onClick={() => remove(index)}
                          aria-label={`Quitar antecedente ${index + 1}`}
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
