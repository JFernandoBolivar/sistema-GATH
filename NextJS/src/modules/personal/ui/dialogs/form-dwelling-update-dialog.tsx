"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/components/dialog";
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
import { useCatalogoDependiente } from "../use-catalogo-dependiente";

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
  const parroquiaId = watch("parroquiaId");
  const codigoPostalId = watch("codigoPostalId");

  // Cascada Estado -> Municipio -> Parroquia y Estado -> Código Postal.
  const { opciones: municipios } = useCatalogoDependiente("municipios", estadoId, {
    valorActual: municipioId,
    respaldo: catalogos?.municipios,
  });
  const { opciones: parroquias } = useCatalogoDependiente("parroquias", municipioId, {
    valorActual: parroquiaId,
    respaldo: catalogos?.parroquias,
  });
  const { opciones: codigosPostales } = useCatalogoDependiente("codigosPostales", estadoId, {
    valorActual: codigoPostalId,
    respaldo: catalogos?.codigosPostales,
  });

  const onSubmit: Parameters<typeof handleSubmit>[0] = (data) => {
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
          const msg = (result as { error: string }).error;
          setError(msg);
          toast.error(msg);
          return;
        }

        toast.success("Datos de vivienda actualizados exitosamente");
        setOpen(false);
        onGuardado();
      } catch {
        const msg = "Error al actualizar datos de vivienda.";
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl p-0">
        <DialogTitle className="sr-only">Actualizar Datos de Vivienda</DialogTitle>

        <Card className="w-full h-full border-0 shadow-none">
          <CardHeader>
            <CardTitle>Datos Socio-economicos</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            <CardAction className="text-gray-500 mb-3">Datos De Vivienda</CardAction>

            {error && (
              <p role="alert" className="text-sm text-destructive mb-3">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="estadoId">Estado *</Label>
                <Select
                  value={estadoId ? String(estadoId) : undefined}
                  onValueChange={(v) => {
                    setValue("estadoId", Number(v));
                    setValue("municipioId", 0);
                    setValue("parroquiaId", 0);
                    setValue("codigoPostalId", 0);
                  }}
                >
                  <SelectTrigger id="estadoId" className="w-full truncate">
                    <SelectValue placeholder="Seleccione un Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {(catalogos?.estados ?? []).map((est) => (
                      <SelectItem key={est.id} value={String(est.id)}>
                        {est.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground block mt-1">
                  Esta Información Sera Publica
                </span>
              </div>

              <div>
                <Label htmlFor="municipioId">Municipio *</Label>
                <Select
                  value={municipioId ? String(municipioId) : ""}
                  onValueChange={(v) => {
                    setValue("municipioId", Number(v));
                    setValue("parroquiaId", 0);
                  }}
                >
                  <SelectTrigger id="municipioId" className="w-full truncate">
                    <SelectValue placeholder="Seleccione un Municpio" />
                  </SelectTrigger>
                  <SelectContent>
                    {municipios.map((mun) => (
                      <SelectItem key={mun.id} value={String(mun.id)}>
                        {mun.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground block mt-1">
                  Esta Información Sera Publica
                </span>
              </div>

              <div>
                <Label htmlFor="parroquiaId">Parroquia *</Label>
                <Select
                  value={parroquiaId ? String(parroquiaId) : ""}
                  onValueChange={(v) => setValue("parroquiaId", Number(v))}
                >
                  <SelectTrigger id="parroquiaId" className="w-full truncate">
                    <SelectValue placeholder="Seleccione una Parroquia" />
                  </SelectTrigger>
                  <SelectContent>
                    {parroquias.map((par) => (
                      <SelectItem key={par.id} value={String(par.id)}>
                        {par.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground block mt-1">
                  Esta Información Sera Publica
                </span>
              </div>

              <div>
                <Label htmlFor="condicionViviendaId">Condicion De Vivienda *</Label>
                <Select
                  value={
                    watch("condicionViviendaId") ? String(watch("condicionViviendaId")) : undefined
                  }
                  onValueChange={(v) => setValue("condicionViviendaId", Number(v))}
                >
                  <SelectTrigger id="condicionViviendaId" className="w-full truncate">
                    <SelectValue placeholder="Seleccione una Condicion De Vivienda" />
                  </SelectTrigger>
                  <SelectContent>
                    {(catalogos?.condicionesVivienda ?? []).map((cond) => (
                      <SelectItem key={cond.id} value={String(cond.id)}>
                        {cond.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground block mt-1">
                  Esta Información Sera Publica
                </span>
              </div>

              <div className="col-span-2">
                <Label htmlFor="direccionExacta">Direccion Exacta *</Label>
                <Input
                  id="direccionExacta"
                  {...register("direccionExacta")}
                  placeholder="Calle, Casa, Apartamento, Sector"
                />
              </div>

              <div>
                <Label htmlFor="codigoPostalId">Código Postal *</Label>
                <Select
                  value={codigoPostalId ? String(codigoPostalId) : ""}
                  onValueChange={(v) => setValue("codigoPostalId", Number(v))}
                >
                  <SelectTrigger id="codigoPostalId" className="w-full truncate">
                    <SelectValue placeholder="Seleccione un Código Postal" />
                  </SelectTrigger>
                  <SelectContent>
                    {codigosPostales.map((cp) => (
                      <SelectItem key={cp.id} value={String(cp.id)}>
                        {cp.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full col-span-2 mt-2" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin mr-1" />}
                {isPending ? "Actualizando" : "Actualizar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
