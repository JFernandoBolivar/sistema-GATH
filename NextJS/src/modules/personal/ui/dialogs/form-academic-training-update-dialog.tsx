"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Loader2, Plus, Trash, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/components/dialog";
import { Combobox } from "@/shared/ui/components/combobox";
import { Label } from "@/shared/ui/components/label";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type {
  CatalogoEmpleadoDTO,
  CatalogosExpedienteDTO,
  EmpleadoDTO,
} from "../../application/dtos/empleado-dto";
import { actualizarEmpleadoAction } from "../../infrastructure/actions/personal-actions";
import { useCatalogoDependiente } from "../use-catalogo-dependiente";
import { ID_OTRA, esNivelNoPosee } from "../catalogo-otra";
import { resolverPendientesOtra, type PendienteOtra } from "../resolver-otra";
import { Input } from "@/shared/ui/components/input";
import { avisoDeFallo, mensajeDe } from "./campo-dialogo";

/** Ruta del API -> campo del formulario. */
const MAPA_ERRORES = {
  formacion_academica: "formacionAcademica",
  nivel_academico: "nivelAcademicoId",
  carrera: "carreraId",
  mencion: "mencionId",
  institucion: "institucionId",
};

function MensajeFila({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {error}
    </p>
  ) : null;
}

/** Combobox con buscador de catálogo en cascada (Carrera por nivel, Mención por carrera). */
function SelectDependiente({
  tipo,
  padreId,
  value,
  onChange,
  respaldo,
  permitirOtra,
}: {
  tipo: "carreras" | "menciones";
  padreId: number | undefined;
  value: number | undefined;
  onChange: (id: number) => void;
  respaldo: CatalogoEmpleadoDTO[];
  permitirOtra: boolean;
}) {
  const { opciones, isLoading } = useCatalogoDependiente(tipo, padreId, {
    valorActual: value,
    respaldo,
  });
  return (
    <Combobox
      options={[
        ...opciones.map((o) => ({ value: String(o.id), label: o.nombre })),
        ...(permitirOtra ? [{ value: String(ID_OTRA), label: "Otra" }] : []),
      ]}
      value={value ? String(value) : ""}
      onChange={(v) => onChange(Number(v))}
      placeholder={isLoading ? "Cargando..." : "Seleccione"}
      searchPlaceholder={tipo === "carreras" ? "Buscar carrera..." : "Buscar mención..."}
      disabled={isLoading}
    />
  );
}

interface FormacionAcademicaFormItem {
  id?: number;
  nivelAcademicoId?: number;
  carreraId?: number;
  mencionId?: number;
  institucionId?: number;
  nuevaCarreraNombre: string;
  nuevaMencionNombre: string;
  nuevaInstitucionNombre: string;
}

interface FormAcademicTrainingValues {
  formacionAcademica: FormacionAcademicaFormItem[];
}

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

  const form = useForm<FormAcademicTrainingValues>({
    defaultValues: {
      formacionAcademica:
        (empleado.formacionAcademica ?? []).length > 0
          ? (empleado.formacionAcademica ?? []).map((fa) => ({
              id: fa.id,
              nivelAcademicoId: fa.nivelAcademicoId ?? 0,
              carreraId: fa.carreraId ?? 0,
              mencionId: fa.mencionId ?? 0,
              institucionId: fa.institucionId ?? 0,
              nuevaCarreraNombre: "",
              nuevaMencionNombre: "",
              nuevaInstitucionNombre: "",
            }))
          : [
              {
                nivelAcademicoId: 0,
                carreraId: 0,
                mencionId: 0,
                institucionId: 0,
                nuevaCarreraNombre: "",
                nuevaMencionNombre: "",
                nuevaInstitucionNombre: "",
              },
            ],
    },
  });

  const { control, register, handleSubmit, setValue, watch } = form;
  const erroresFilas = form.formState.errors.formacionAcademica;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "formacionAcademica",
  });

  const onSubmit = (data: FormAcademicTrainingValues) => {
    startTransition(async () => {
      setError(null);

      const rawItems = data.formacionAcademica || [];
      const hasPartial = rawItems.some(
        (fa) =>
          (fa.nivelAcademicoId || fa.carreraId || fa.institucionId || fa.mencionId) &&
          (!fa.nivelAcademicoId || !fa.institucionId),
      );
      if (hasPartial) {
        const msg =
          "Por favor complete el Nivel Académico y la Institución en las formaciones académicas agregadas.";
        setError(msg);
        toast.error(msg);
        return;
      }

      // Opción "Otra": crear/reutilizar carrera, mención o institución nueva antes de guardar.
      const pendientes: PendienteOtra[] = [];
      rawItems.forEach((fa) => {
        if (Number(fa.carreraId) === ID_OTRA) {
          pendientes.push({
            solicitud: {
              tipo: "carreras",
              nombre: fa.nuevaCarreraNombre ?? "",
              padreId: Number(fa.nivelAcademicoId),
            },
            faltaNombre: "Debe escribir el nombre de la nueva carrera",
            asignar: (id) => (fa.carreraId = id),
          });
        }
        if (Number(fa.mencionId) === ID_OTRA) {
          pendientes.push({
            solicitud: {
              tipo: "menciones",
              nombre: fa.nuevaMencionNombre ?? "",
              padreId: Number(fa.carreraId),
            },
            faltaNombre: "Debe escribir el nombre de la nueva mención",
            asignar: (id) => (fa.mencionId = id),
          });
        }
        if (Number(fa.institucionId) === ID_OTRA) {
          pendientes.push({
            solicitud: { tipo: "instituciones", nombre: fa.nuevaInstitucionNombre ?? "" },
            faltaNombre: "Debe escribir el nombre de la nueva institución",
            asignar: (id) => (fa.institucionId = id),
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
          formacionAcademica: rawItems
            .filter((fa) => fa.nivelAcademicoId && fa.institucionId)
            .map((fa) => ({
              id: fa.id,
              nivelAcademicoId: Number(fa.nivelAcademicoId),
              carreraId: fa.carreraId ? Number(fa.carreraId) : null,
              mencionId: fa.mencionId ? Number(fa.mencionId) : null,
              institucionId: Number(fa.institucionId),
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

        toast.success("Formación académica actualizada exitosamente");
        setOpen(false);
        onGuardado();
      } catch {
        const msg = "Error al actualizar la formación académica.";
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
        <DialogTitle className="sr-only">Actualizar Formación Académica</DialogTitle>

        <Card className="w-full h-full border-0 shadow-none">
          <CardHeader>
            <CardTitle>Formacion Academica</CardTitle>
          </CardHeader>

          <CardContent>
            <CardAction className="text-gray-500 mb-3">Información Academica</CardAction>

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
                      setValue("formacionAcademica", [
                        {
                          nivelAcademicoId: 0,
                          carreraId: 0,
                          mencionId: 0,
                          institucionId: 0,
                          nuevaCarreraNombre: "",
                          nuevaMencionNombre: "",
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
                        nivelAcademicoId: 0,
                        carreraId: 0,
                        mencionId: 0,
                        institucionId: 0,
                        nuevaCarreraNombre: "",
                        nuevaMencionNombre: "",
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
                  Opcional si no posee formación académica
                </h1>
                <div className="flex flex-col gap-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="@container flex flex-col gap-3 border-b pb-3 mb-2 w-full"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Formación {index + 1}</span>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className={`${index === 0 ? "invisible" : ""} cursor-pointer size-8 shrink-0`}
                          onClick={() => remove(index)}
                          aria-label={`Quitar formación académica ${index + 1}`}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 items-start gap-3 @lg:grid-cols-2">
                      <div className="min-w-0">
                        <Label className="text-xs">Nivel Academico</Label>
                        <Select
                          value={
                            watch(`formacionAcademica.${index}.nivelAcademicoId`)
                              ? String(watch(`formacionAcademica.${index}.nivelAcademicoId`))
                              : undefined
                          }
                          onValueChange={(v) => {
                            setValue(`formacionAcademica.${index}.nivelAcademicoId`, Number(v));
                            setValue(`formacionAcademica.${index}.carreraId`, 0);
                            setValue(`formacionAcademica.${index}.mencionId`, 0);
                          }}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-invalid={!!erroresFilas?.[index]?.nivelAcademicoId || undefined}
                          >
                            <SelectValue placeholder="Seleccione" />
                          </SelectTrigger>
                          <SelectContent>
                            {(catalogos?.nivelesAcademicos ?? []).map((n) => (
                              <SelectItem key={n.id} value={String(n.id)}>
                                {n.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <MensajeFila error={mensajeDe(erroresFilas?.[index]?.nivelAcademicoId)} />
                      </div>

                      <div className="min-w-0">
                        <Label className="text-xs">Carrera (Opcional)</Label>
                        <SelectDependiente
                          tipo="carreras"
                          padreId={watch(`formacionAcademica.${index}.nivelAcademicoId`)}
                          value={watch(`formacionAcademica.${index}.carreraId`)}
                          onChange={(id) => {
                            setValue(`formacionAcademica.${index}.carreraId`, id);
                            setValue(`formacionAcademica.${index}.mencionId`, 0);
                          }}
                          respaldo={catalogos?.carreras ?? []}
                          permitirOtra={
                            Number(watch(`formacionAcademica.${index}.nivelAcademicoId`)) > 0 &&
                            !esNivelNoPosee(
                              catalogos?.nivelesAcademicos.find(
                                (n) =>
                                  n.id ===
                                  Number(watch(`formacionAcademica.${index}.nivelAcademicoId`)),
                              )?.nombre,
                            )
                          }
                        />
                        <MensajeFila error={mensajeDe(erroresFilas?.[index]?.carreraId)} />
                        {Number(watch(`formacionAcademica.${index}.carreraId`)) === ID_OTRA && (
                          <Input
                            className="mt-1"
                            maxLength={200}
                            placeholder="Nueva carrera..."
                            {...register(`formacionAcademica.${index}.nuevaCarreraNombre`)}
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <Label className="text-xs">Mención (Opcional)</Label>
                        <SelectDependiente
                          tipo="menciones"
                          padreId={watch(`formacionAcademica.${index}.carreraId`)}
                          value={watch(`formacionAcademica.${index}.mencionId`)}
                          onChange={(id) => setValue(`formacionAcademica.${index}.mencionId`, id)}
                          respaldo={catalogos?.menciones ?? []}
                          permitirOtra={Number(watch(`formacionAcademica.${index}.carreraId`)) > 0}
                        />
                        <MensajeFila error={mensajeDe(erroresFilas?.[index]?.mencionId)} />
                        {Number(watch(`formacionAcademica.${index}.mencionId`)) === ID_OTRA && (
                          <Input
                            className="mt-1"
                            maxLength={200}
                            placeholder="Nueva mención..."
                            {...register(`formacionAcademica.${index}.nuevaMencionNombre`)}
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <Label className="text-xs">Institución (Opcional)</Label>
                        <Combobox
                          options={[
                            ...(catalogos?.instituciones ?? []).map((inst) => ({
                              value: String(inst.id),
                              label: inst.nombre,
                            })),
                            { value: String(ID_OTRA), label: "Otra" },
                          ]}
                          value={
                            watch(`formacionAcademica.${index}.institucionId`)
                              ? String(watch(`formacionAcademica.${index}.institucionId`))
                              : ""
                          }
                          onChange={(v) =>
                            setValue(`formacionAcademica.${index}.institucionId`, Number(v))
                          }
                          placeholder="Seleccione"
                          searchPlaceholder="Buscar institución..."
                        />
                        <MensajeFila error={mensajeDe(erroresFilas?.[index]?.institucionId)} />
                        {Number(watch(`formacionAcademica.${index}.institucionId`)) === ID_OTRA && (
                          <Input
                            className="mt-1"
                            maxLength={200}
                            placeholder="Nueva institución..."
                            {...register(`formacionAcademica.${index}.nuevaInstitucionNombre`)}
                          />
                        )}
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
