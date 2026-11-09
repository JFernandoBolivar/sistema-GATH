"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Loader2, Plus, Trash, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Combobox } from "@/shared/ui/components/combobox";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
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
import { avisoDeFallo, mensajeDe } from "./campo-dialogo";

/** Ruta del API -> campo del formulario. */
const MAPA_ERRORES = {
  formacion_complementaria: "formacionComplementaria",
  capacitacion: "capacitacionId",
  institucion: "institucionId",
  procedencia: "procedenciaId",
  grupo: "grupoId",
  horas_completadas: "horasCompletadas",
  dias_completados: "horasCompletadas",
};

function MensajeFila({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {error}
    </p>
  ) : null;
}

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

  const form = useForm<FormSupplementaryTrainingValues>({
      defaultValues: {
        formacionComplementaria:
          (empleado.formacionComplementaria ?? []).length > 0
            ? (empleado.formacionComplementaria ?? []).map((fc) => ({
                id: fc.id,
                capacitacionId: fc.capacitacionId ?? 0,
                institucionId: fc.institucionId ?? 0,
                fechaInicio: fc.fechaInicio ?? "",
                fechaFin: fc.fechaFin ?? "",
                procedenciaId: fc.procedenciaId ?? 0,
                grupoId: fc.grupoId ?? 0,
                horasCompletadas: fc.horasCompletadas ?? "",
                nuevaCapacitacionNombre: "",
                nuevaInstitucionNombre: "",
              }))
            : [
                {
                  capacitacionId: 0,
                  institucionId: 0,
                  fechaInicio: "",
                  fechaFin: "",
                  procedenciaId: 0,
                  grupoId: 0,
                  horasCompletadas: "",
                  nuevaCapacitacionNombre: "",
                  nuevaInstitucionNombre: "",
                },
              ],
      },
    });

  const { control, register, handleSubmit, setValue, watch } = form;
  const erroresFilas = form.formState.errors.formacionComplementaria;

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
          const fallo = result as { error: string; errores?: Record<string, string[]> };
          const sinUbicar = aplicarErroresServidor(form, fallo.errores, MAPA_ERRORES);
          setError(avisoDeFallo(fallo, sinUbicar));
          toast.error(fallo.error);
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
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-4xl p-0">
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
                          capacitacionId: 0,
                          institucionId: 0,
                          fechaInicio: "",
                          fechaFin: "",
                          procedenciaId: 0,
                          grupoId: 0,
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
                        capacitacionId: 0,
                        institucionId: 0,
                        fechaInicio: "",
                        fechaFin: "",
                        procedenciaId: 0,
                        grupoId: 0,
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

              <div className="rounded-md w-full border p-3">
                <h1 className="text-gray-600 text-sm mb-3">
                  Opcional si no posee formación complementaria
                </h1>
                <div className="flex flex-col gap-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="@container flex flex-col gap-3 border-b pb-3 mb-2 w-full"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Curso {index + 1}</span>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className={`${index === 0 ? "invisible" : ""} cursor-pointer size-8 shrink-0`}
                          onClick={() => remove(index)}
                          aria-label={`Quitar formación complementaria ${index + 1}`}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 items-start gap-3 @md:grid-cols-2 @3xl:grid-cols-3">
                      <div className="min-w-0">
                        <Label className="text-xs">Fecha Inicio</Label>
                        <Input
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          min="1930-01-01"
                          className="h-9 text-xs"
                          {...register(`formacionComplementaria.${index}.fechaInicio` as const)}
                        />
                        <MensajeFila error={mensajeDe(erroresFilas?.[index]?.fechaInicio)} />
                      </div>

                      <div className="min-w-0">
                        <Label className="text-xs">Fecha Culminacion</Label>
                        <Input
                          type="date"
                          max={new Date().toISOString().split("T")[0]}
                          min="1930-01-01"
                          className="h-9 text-xs"
                          {...register(`formacionComplementaria.${index}.fechaFin` as const)}
                        />
                        <MensajeFila error={mensajeDe(erroresFilas?.[index]?.fechaFin)} />
                      </div>

                      <div className="min-w-0">
                        <Label className="text-xs">Capacitación</Label>
                        <Combobox
                          options={[
                            ...(catalogos?.capacitaciones ?? []).map((cap) => ({
                              value: String(cap.id),
                              label: cap.nombre,
                            })),
                            { value: String(ID_OTRA), label: "Otra" },
                          ]}
                          value={
                            watch(`formacionComplementaria.${index}.capacitacionId`)
                              ? String(watch(`formacionComplementaria.${index}.capacitacionId`))
                              : ""
                          }
                          onChange={(v) =>
                            setValue(`formacionComplementaria.${index}.capacitacionId`, Number(v))
                          }
                          placeholder="Seleccione"
                          searchPlaceholder="Buscar capacitación..."
                        />
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
                        <MensajeFila error={mensajeDe(erroresFilas?.[index]?.capacitacionId)} />
                      </div>

                      <div className="min-w-0">
                        <Label className="text-xs">Institución</Label>
                        <Combobox
                          options={[
                            ...(catalogos?.instituciones ?? []).map((inst) => ({
                              value: String(inst.id),
                              label: inst.nombre,
                            })),
                            { value: String(ID_OTRA), label: "Otra" },
                          ]}
                          value={
                            watch(`formacionComplementaria.${index}.institucionId`)
                              ? String(watch(`formacionComplementaria.${index}.institucionId`))
                              : ""
                          }
                          onChange={(v) =>
                            setValue(`formacionComplementaria.${index}.institucionId`, Number(v))
                          }
                          placeholder="Seleccione"
                          searchPlaceholder="Buscar institución..."
                        />
                        {Number(watch(`formacionComplementaria.${index}.institucionId`)) ===
                          ID_OTRA && (
                          <Input
                            className="mt-1 h-8 text-xs"
                            placeholder="Nueva institución..."
                            {...register(`formacionComplementaria.${index}.nuevaInstitucionNombre`)}
                          />
                        )}
                        <MensajeFila error={mensajeDe(erroresFilas?.[index]?.institucionId)} />
                      </div>

                      <div className="min-w-0">
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
                        <MensajeFila error={mensajeDe(erroresFilas?.[index]?.procedenciaId)} />
                      </div>

                      <div className="min-w-0">
                        <Label className="text-xs">Horas</Label>
                        <Input
                          placeholder="40"
                          inputMode="numeric"
                          maxLength={5}
                          className="h-9 text-xs"
                          aria-invalid={!!erroresFilas?.[index]?.horasCompletadas || undefined}
                          {...register(
                            `formacionComplementaria.${index}.horasCompletadas` as const,
                          )}
                        />
                        <MensajeFila error={mensajeDe(erroresFilas?.[index]?.horasCompletadas)} />
                      </div>

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
