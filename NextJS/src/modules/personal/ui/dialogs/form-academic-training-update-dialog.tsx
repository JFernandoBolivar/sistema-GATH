"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Loader2, Plus, Trash, X } from "lucide-react";
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
import { Label } from "@/shared/ui/components/label";
import { ScrollArea } from "@/shared/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogoEmpleadoDTO, CatalogosExpedienteDTO, EmpleadoDTO } from "../../application/dtos/empleado-dto";
import { actualizarEmpleadoAction } from "../../infrastructure/actions/personal-actions";
import { useCatalogoDependiente } from "../use-catalogo-dependiente";

/** Select de catálogo en cascada (Carrera por nivel, Mención por carrera). */
function SelectDependiente({
  tipo,
  padreId,
  value,
  onChange,
  respaldo,
}: {
  tipo: "carreras" | "menciones";
  padreId: number | undefined;
  value: number | undefined;
  onChange: (id: number) => void;
  respaldo: CatalogoEmpleadoDTO[];
}) {
  const { opciones, isLoading } = useCatalogoDependiente(tipo, padreId, { valorActual: value, respaldo });
  return (
    <Select value={value ? String(value) : ""} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione"} />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
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

      const rawItems = data.formacionAcademica || [];
      const hasPartial = rawItems.some(
        (fa: any) =>
          (fa.nivelAcademicoId || fa.carreraId || fa.institucionId || fa.mencionId) &&
          (!fa.nivelAcademicoId || !fa.institucionId)
      );
      if (hasPartial) {
        const msg = "Por favor complete el Nivel Académico y la Institución en las formaciones académicas agregadas.";
        setError(msg);
        toast.error(msg);
        return;
      }

      try {
        const payload = {
          formacionAcademica: rawItems
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
          const msg = (result as { error: string }).error;
          setError(msg);
          toast.error(msg);
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
                      setValue("formacionAcademica", [
                        { nivelAcademicoId: undefined, carreraId: undefined, mencionId: undefined, institucionId: undefined },
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
                        nivelAcademicoId: undefined,
                        carreraId: undefined,
                        mencionId: undefined,
                        institucionId: undefined,
                      })
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-64 rounded-md w-full border p-2">
                <h1 className="text-gray-600 text-sm mb-3">
                  Opcional si no posee formación académica
                </h1>
                <div className="flex flex-col gap-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex flex-row gap-3 items-end w-full">
                      <div className="flex-1 min-w-[150px]">
                        <Label>{index + 1}. Nivel Academico</Label>
                        <Select
                          value={watch(`formacionAcademica.${index}.nivelAcademicoId`) ? String(watch(`formacionAcademica.${index}.nivelAcademicoId`)) : undefined}
                          onValueChange={(v) => {
                            setValue(`formacionAcademica.${index}.nivelAcademicoId`, Number(v));
                            setValue(`formacionAcademica.${index}.carreraId`, 0);
                            setValue(`formacionAcademica.${index}.mencionId`, 0);
                          }}
                        >
                          <SelectTrigger className="w-full">
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
                      </div>

                      <div className="flex-1 min-w-[150px]">
                        <Label>Carrera (Opcional)</Label>
                        <SelectDependiente
                          tipo="carreras"
                          padreId={watch(`formacionAcademica.${index}.nivelAcademicoId`)}
                          value={watch(`formacionAcademica.${index}.carreraId`)}
                          onChange={(id) => {
                            setValue(`formacionAcademica.${index}.carreraId`, id);
                            setValue(`formacionAcademica.${index}.mencionId`, 0);
                          }}
                          respaldo={catalogos?.carreras ?? []}
                        />
                      </div>

                      <div className="flex-1 min-w-[150px]">
                        <Label>Mención (Opcional)</Label>
                        <SelectDependiente
                          tipo="menciones"
                          padreId={watch(`formacionAcademica.${index}.carreraId`)}
                          value={watch(`formacionAcademica.${index}.mencionId`)}
                          onChange={(id) => setValue(`formacionAcademica.${index}.mencionId`, id)}
                          respaldo={catalogos?.menciones ?? []}
                        />
                      </div>

                      <div className="flex-1 min-w-[150px]">
                        <Label>Institución (Opcional)</Label>
                        <Select
                          value={watch(`formacionAcademica.${index}.institucionId`) ? String(watch(`formacionAcademica.${index}.institucionId`)) : undefined}
                          onValueChange={(v) => setValue(`formacionAcademica.${index}.institucionId`, Number(v))}
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
