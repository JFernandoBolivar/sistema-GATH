"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
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

import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import { avisoDeFallo, mensajeDe } from "./campo-dialogo";

/** Ruta del API -> campo del formulario. */
const MAPA_ERRORES = {
  contrato: "contrato",
  n_contrato: "nContrato",
  fecha_ingreso: "fechaIngreso",
  fecha_culminacion: "fechaCulminacion",
  politica_id: "politicaId",
};
import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../../application/dtos/empleado-dto";
import { actualizarEmpleadoAction } from "../../infrastructure/actions/personal-actions";

interface FormContratoUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

function MensajeFila({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {error}
    </p>
  ) : null;
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

  const initialContratos =
    empleado.contratos && empleado.contratos.length > 0
      ? empleado.contratos
      : empleado.contratoActual
        ? [empleado.contratoActual]
        : [];

  interface ContratoFormItem {
    id?: number;
    nContrato: string;
    fechaIngreso: string;
    fechaCulminacion: string;
    politicaId?: number;
    esFijo: boolean;
  }

  const form = useForm<{
    contrato: ContratoFormItem[];
  }>({
    defaultValues: {
      contrato:
        initialContratos.length > 0
          ? initialContratos.map((c) => ({
              id: c.id,
              nContrato: c.nContrato ?? "",
              fechaIngreso: c.fechaIngreso ?? "",
              fechaCulminacion: c.fechaCulminacion ?? "",
              politicaId: c.politicaId ?? 0,
              esFijo: c.esFijo ?? false,
            }))
          : [],
    },
  });

  const { control, register, handleSubmit, setValue, watch } = form;
  const erroresContrato = form.formState.errors.contrato;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "contrato",
  });

  const onSubmit = (data: { contrato: ContratoFormItem[] }) => {
    startTransition(async () => {
      setError(null);

      const rawItems = data.contrato || [];
      const hasPartial = rawItems.some(
        (c) => (c.nContrato || c.fechaCulminacion || c.politicaId) && !c.fechaIngreso,
      );
      if (hasPartial) {
        const msg = "Por favor complete la Fecha de Inicio en los contratos agregados.";
        setError(msg);
        toast.error(msg);
        return;
      }

      try {
        const payload = {
          contrato: rawItems
            .filter((c) => c.fechaIngreso)
            .map((c) => ({
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
          const fallo = result as { error: string; errores?: Record<string, string[]> };
          const sinUbicar = aplicarErroresServidor(form, fallo.errores, MAPA_ERRORES);
          setError(avisoDeFallo(fallo, sinUbicar));
          toast.error(fallo.error);
          return;
        }

        toast.success("Contratos actualizados exitosamente");
        setOpen(false);
        onGuardado();
      } catch {
        const msg = "Error al actualizar los contratos.";
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
        <DialogTitle className="sr-only">Gestión de Contratos</DialogTitle>

        <Card className="w-full h-full border-0 shadow-none flex flex-col gap-3">
          <CardHeader>
            <CardTitle>Gestión de Contratos</CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            {error && (
              <p role="alert" className="text-sm text-destructive mb-3">
                {error}
              </p>
            )}

            <form className="flex flex-col gap-2" onSubmit={handleSubmit(onSubmit)}>
              <div className="flex justify-end gap-2 mr-4 items-center">
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
                        nContrato: "",
                        fechaIngreso: "",
                        fechaCulminacion: "",
                        politicaId: 0,
                        esFijo: false,
                      });
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto rounded-md w-full border p-3">
                {fields.length === 0 && (
                  <h1 className="text-gray-600 text-center py-4 text-sm">
                    No hay contratos registrados.
                  </h1>
                )}
                <div className="flex flex-col gap-3">
                  {fields.map((field, index) => {
                    const isExisting = Boolean(initialContratos[index]?.id);
                    const isVencido = initialContratos[index]?.estatusNombre === "VENCIDO";

                    return (
                      <div
                        key={field.id}
                        className="@container relative grid grid-cols-1 gap-3 items-start w-full py-2 border-b @md:grid-cols-2 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]"
                      >
                        {isVencido && (
                          <Badge className="bg-red-600 text-white text-xs col-span-full w-fit mb-1">
                            VENCIDO - Solo lectura
                          </Badge>
                        )}

                        <div className="flex min-w-0 flex-col">
                          <Label className="text-xs">{index + 1}. N° Contrato</Label>
                          <Input
                            {...register(`contrato.${index}.nContrato` as const)}
                            readOnly={isExisting}
                            className={`flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm ${
                              isExisting ? "opacity-50 cursor-not-allowed bg-muted" : ""
                            }`}
                            placeholder="CTR-001"
                            maxLength={30}
                            aria-invalid={!!erroresContrato?.[index]?.nContrato || undefined}
                          />
                          <MensajeFila error={mensajeDe(erroresContrato?.[index]?.nContrato)} />
                        </div>

                        <div className="flex min-w-0 flex-col">
                          <Label className="text-xs">Fecha Inicio</Label>
                          <Input
                            type="date"
                            max={new Date().toISOString().split("T")[0]}
                            min="1930-01-01"
                            disabled={isVencido}
                            className="h-9 text-xs"
                            aria-invalid={!!erroresContrato?.[index]?.fechaIngreso || undefined}
                            {...register(`contrato.${index}.fechaIngreso` as const, {
                              required: true,
                            })}
                          />
                          <MensajeFila error={mensajeDe(erroresContrato?.[index]?.fechaIngreso)} />
                        </div>

                        <div className="flex min-w-0 flex-col">
                          <Label className="text-xs">Fecha Culminación</Label>
                          <Input
                            type="date"
                            min="1930-01-01"
                            disabled={isVencido}
                            className="h-9 text-xs"
                            aria-invalid={!!erroresContrato?.[index]?.fechaCulminacion || undefined}
                            {...register(`contrato.${index}.fechaCulminacion` as const)}
                          />
                          <MensajeFila error={mensajeDe(erroresContrato?.[index]?.fechaCulminacion)} />
                        </div>

                        <div className="flex min-w-0 flex-col">
                          <Label className="text-xs">Política</Label>
                          <Select
                            value={
                              watch(`contrato.${index}.politicaId`)
                                ? String(watch(`contrato.${index}.politicaId`))
                                : undefined
                            }
                            onValueChange={(v) =>
                              setValue(`contrato.${index}.politicaId`, Number(v))
                            }
                            disabled={isVencido}
                          >
                            <SelectTrigger
                              className="w-full h-9 text-xs"
                              aria-invalid={!!erroresContrato?.[index]?.politicaId || undefined}
                            >
                              <SelectValue placeholder="Seleccione" />
                            </SelectTrigger>
                            <SelectContent>
                              {(catalogos?.politicas ?? []).map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <MensajeFila error={mensajeDe(erroresContrato?.[index]?.politicaId)} />
                        </div>

                        {!isVencido && (
                          <div className="pt-5 flex justify-end">
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="cursor-pointer size-8"
                              onClick={() => remove(index)}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button className="mt-4 w-full cursor-pointer" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin mr-1" />}
                {isPending ? "Actualizando..." : "Guardar Cambios"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
