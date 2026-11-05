"use client";

import { ContadorCampo } from "@/components/contador-caracteres";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/components/dialog";
import { Input } from "@/shared/ui/components/input";
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
import { Combobox } from "@/shared/ui/components/combobox";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import { DIRECCION_MAX } from "../schema/reglas-personas";
import { CampoDialogo, avisoDeFallo, mensajeDe } from "./campo-dialogo";

/** Ruta del API -> campo del formulario. */
const MAPA_ERRORES = {
  "datos_vivienda.estado": "estadoId",
  "datos_vivienda.municipio": "municipioId",
  "datos_vivienda.parroquia": "parroquiaId",
  "datos_vivienda.condicion_vivienda": "condicionViviendaId",
  "datos_vivienda.direccion_exacta": "direccionExacta",
  "datos_vivienda.codigo_postal": "codigoPostalId",
};

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

  const form = useForm({
    defaultValues: {
      estadoId: empleado.datosVivienda?.estadoId ?? 0,
      municipioId: empleado.datosVivienda?.municipioId ?? 0,
      parroquiaId: empleado.datosVivienda?.parroquiaId ?? 0,
      condicionViviendaId: empleado.datosVivienda?.condicionViviendaId ?? 0,
      direccionExacta: empleado.datosVivienda?.direccionExacta ?? "",
      codigoPostalId: empleado.datosVivienda?.codigoPostalId ?? 0,
    },
  });
  const { register, handleSubmit, setValue, watch } = form;
  const errores = form.formState.errors;

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
          const fallo = result as { error: string; errores?: Record<string, string[]> };
          const sinUbicar = aplicarErroresServidor(form, fallo.errores, MAPA_ERRORES);
          setError(avisoDeFallo(fallo, sinUbicar));
          toast.error(fallo.error);
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

            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoDialogo id="estadoId" label="Estado *" error={mensajeDe(errores.estadoId)}>
                <Combobox
                  id="estadoId"
                  invalido={!!errores.estadoId}
                  value={estadoId ? String(estadoId) : ""}
                  onChange={(v) => {
                    setValue("estadoId", Number(v));
                    setValue("municipioId", 0);
                    setValue("parroquiaId", 0);
                    setValue("codigoPostalId", 0);
                  }}
                  options={(catalogos?.estados ?? []).map((o) => ({ value: String(o.id), label: o.nombre }))}
                  placeholder="Seleccione un Estado"
                  searchPlaceholder="Buscar estado…"
                  emptyText="No hay coincidencias."
                />
                <span className="text-xs text-muted-foreground">Esta Información Sera Publica</span>
              </CampoDialogo>

              <CampoDialogo id="municipioId" label="Municipio *" error={mensajeDe(errores.municipioId)}>
                <Combobox
                  id="municipioId"
                  invalido={!!errores.municipioId}
                  value={municipioId ? String(municipioId) : ""}
                  onChange={(v) => {
                    setValue("municipioId", Number(v));
                    setValue("parroquiaId", 0);
                  }}
                  options={municipios.map((o) => ({ value: String(o.id), label: o.nombre }))}
                  placeholder="Seleccione un Municipio"
                  searchPlaceholder="Buscar municipio…"
                  emptyText="No hay coincidencias."
                />
                <span className="text-xs text-muted-foreground">Esta Información Sera Publica</span>
              </CampoDialogo>

              <CampoDialogo id="parroquiaId" label="Parroquia *" error={mensajeDe(errores.parroquiaId)}>
                <Combobox
                  id="parroquiaId"
                  invalido={!!errores.parroquiaId}
                  value={parroquiaId ? String(parroquiaId) : ""}
                  onChange={(v) => {
                    setValue("parroquiaId", Number(v));
                  }}
                  options={parroquias.map((o) => ({ value: String(o.id), label: o.nombre }))}
                  placeholder="Seleccione una Parroquia"
                  searchPlaceholder="Buscar parroquia…"
                  emptyText="No hay coincidencias."
                />
                <span className="text-xs text-muted-foreground">Esta Información Sera Publica</span>
              </CampoDialogo>

              <CampoDialogo
                id="condicionViviendaId"
                label="Condicion De Vivienda *"
                error={mensajeDe(errores.condicionViviendaId)}
              >
                <Select
                  value={
                    watch("condicionViviendaId") ? String(watch("condicionViviendaId")) : undefined
                  }
                  onValueChange={(v) => setValue("condicionViviendaId", Number(v))}
                >
                  <SelectTrigger
                    id="condicionViviendaId"
                    className="w-full truncate"
                    aria-invalid={!!errores.condicionViviendaId || undefined}
                  >
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
                <span className="text-xs text-muted-foreground">Esta Información Sera Publica</span>
              </CampoDialogo>

              <CampoDialogo
                id="direccionExacta"
                label="Direccion Exacta *"
                error={mensajeDe(errores.direccionExacta)}
                className="sm:col-span-2"
              >
                <Input
                  id="direccionExacta"
                  maxLength={DIRECCION_MAX}
                  aria-invalid={!!errores.direccionExacta || undefined}
                  {...register("direccionExacta")}
                  placeholder="Calle, Casa, Apartamento, Sector"
                />
                <ContadorCampo control={form.control} name="direccionExacta" max={DIRECCION_MAX} />
              </CampoDialogo>

              <CampoDialogo id="codigoPostalId" label="Código Postal *" error={mensajeDe(errores.codigoPostalId)}>
                <Combobox
                  id="codigoPostalId"
                  invalido={!!errores.codigoPostalId}
                  value={codigoPostalId ? String(codigoPostalId) : ""}
                  onChange={(v) => {
                    setValue("codigoPostalId", Number(v));
                  }}
                  options={codigosPostales.map((o) => ({ value: String(o.id), label: o.nombre }))}
                  placeholder="Seleccione un Código Postal"
                  searchPlaceholder="Buscar código postal…"
                  emptyText="No hay coincidencias."
                />
              </CampoDialogo>

              <Button className="w-full sm:col-span-2 mt-2" disabled={isPending}>
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
