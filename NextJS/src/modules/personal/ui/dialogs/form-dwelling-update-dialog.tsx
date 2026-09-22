"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

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

interface FormDwellingUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function FormDwellingUpdateDialog({
  empleado,
  catalogos,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar",
}: FormDwellingUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      estadoId: empleado.datosVivienda?.estadoId ?? undefined,
      municipioId: empleado.datosVivienda?.municipioId ?? undefined,
      parroquiaId: empleado.datosVivienda?.parroquiaId ?? undefined,
      condicionViviendaId: empleado.datosVivienda?.condicionViviendaId ?? undefined,
      direccionExacta: empleado.datosVivienda?.direccionExacta ?? "",
      codigoPostalId: empleado.datosVivienda?.codigoPostalId ?? undefined,
    },
  });

  const estadoId = watch("estadoId");
  const municipioId = watch("municipioId");

  const onSubmit = (data: any) => {
    startTransition(async () => {
      setError(null);
      try {
        const payload = {
          datosVivienda: {
            estadoId: data.estadoId ? Number(data.estadoId) : null,
            municipioId: data.municipioId ? Number(data.municipioId) : null,
            parroquiaId: data.parroquiaId ? Number(data.parroquiaId) : null,
            condicionViviendaId: data.condicionViviendaId ? Number(data.condicionViviendaId) : null,
            direccionExacta: data.direccionExacta || "",
            codigoPostalId: data.codigoPostalId ? Number(data.codigoPostalId) : null,
          },
        };

        const result = await actualizarEmpleadoAction(empleado.cedula, payload);
        if (result && typeof result === "object" && "error" in result) {
          setError((result as { error: string }).error);
          return;
        }

        setOpen(false);
        onGuardado();
      } catch {
        setError("Error al actualizar datos de vivienda.");
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Actualizar Datos de Vivienda</DialogTitle>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="estadoId">Estado</Label>
              <Select
                value={estadoId ? String(estadoId) : undefined}
                onValueChange={(v) => {
                  setValue("estadoId", Number(v));
                }}
              >
                <SelectTrigger id="estadoId">
                  <SelectValue placeholder="Seleccione estado" />
                </SelectTrigger>
                <SelectContent>
                  {(catalogos?.estados ?? []).map((est) => (
                    <SelectItem key={est.id} value={String(est.id)}>
                      {est.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="municipioId">Municipio</Label>
              <Select
                value={municipioId ? String(municipioId) : undefined}
                onValueChange={(v) => {
                  setValue("municipioId", Number(v));
                }}
              >
                <SelectTrigger id="municipioId">
                  <SelectValue placeholder="Seleccione municipio" />
                </SelectTrigger>
                <SelectContent>
                  {(catalogos?.municipios ?? []).map((mun) => (
                    <SelectItem key={mun.id} value={String(mun.id)}>
                      {mun.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="parroquiaId">Parroquia</Label>
              <Select
                value={watch("parroquiaId") ? String(watch("parroquiaId")) : undefined}
                onValueChange={(v) => setValue("parroquiaId", Number(v))}
              >
                <SelectTrigger id="parroquiaId">
                  <SelectValue placeholder="Seleccione parroquia" />
                </SelectTrigger>
                <SelectContent>
                  {(catalogos?.parroquias ?? []).map((par) => (
                    <SelectItem key={par.id} value={String(par.id)}>
                      {par.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="condicionViviendaId">Condición de Vivienda</Label>
              <Select
                value={watch("condicionViviendaId") ? String(watch("condicionViviendaId")) : undefined}
                onValueChange={(v) => setValue("condicionViviendaId", Number(v))}
              >
                <SelectTrigger id="condicionViviendaId">
                  <SelectValue placeholder="Seleccione condición" />
                </SelectTrigger>
                <SelectContent>
                  {(catalogos?.condicionesVivienda ?? []).map((cond) => (
                    <SelectItem key={cond.id} value={String(cond.id)}>
                      {cond.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="direccionExacta">Dirección de Habitación</Label>
            <Input id="direccionExacta" {...register("direccionExacta")} placeholder="Dirección detallada..." />
          </div>

          <div>
            <Label htmlFor="codigoPostalId">Código Postal</Label>
            <Select
              value={watch("codigoPostalId") ? String(watch("codigoPostalId")) : undefined}
              onValueChange={(v) => setValue("codigoPostalId", Number(v))}
            >
              <SelectTrigger id="codigoPostalId">
                <SelectValue placeholder="Seleccione código postal" />
              </SelectTrigger>
              <SelectContent>
                {(catalogos?.codigosPostales ?? []).map((cp) => (
                  <SelectItem key={cp.id} value={String(cp.id)}>
                    {cp.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
