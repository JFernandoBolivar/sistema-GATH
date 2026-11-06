"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/components/dialog";
import { Label } from "@/shared/ui/components/label";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import { avisoDeFallo, mensajeDe } from "./campo-dialogo";

/** Ruta del API -> campo del formulario. */
const MAPA_ERRORES = {
  "perfil_fisico.tallaCamisa": "tallaCamisaId",
  "perfil_fisico.tallaPantalon": "tallaPantalonId",
  "perfil_fisico.tallaZapatos": "tallaZapatosId",
  "perfil_fisico.tallaChaqueta": "tallaChaquetaId",
}
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../../application/dtos/empleado-dto";
import { actualizarEmpleadoAction } from "../../infrastructure/actions/personal-actions";
import { useCatalogoDependiente } from "../use-catalogo-dependiente";

interface FormPhysicalProfileUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

function groupByRegion(tallasList: NonNullable<CatalogosExpedienteDTO["tallas"]>) {
  return tallasList.reduce(
    (acc, item) => {
      const region = item.regionCodigo || item.regionDescripcion || "General";
      if (!acc[region]) acc[region] = [];
      acc[region].push(item);
      return acc;
    },
    {} as Record<string, NonNullable<CatalogosExpedienteDTO["tallas"]>>,
  );
}

export default function FormPhysicalProfileUpdateDialog({
  empleado,
  catalogos,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar",
}: FormPhysicalProfileUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      tallaCamisaId: empleado.perfilFisico?.tallaCamisaId ?? 0,
      tallaPantalonId: empleado.perfilFisico?.tallaPantalonId ?? 0,
      tallaZapatosId: empleado.perfilFisico?.tallaZapatosId ?? 0,
      tallaChaquetaId: empleado.perfilFisico?.tallaChaquetaId ?? 0,
    },
  });

  const { handleSubmit, setValue, watch } = form;
  const errores = form.formState.errors;

  const tallaCamisaId = watch("tallaCamisaId");
  const tallaPantalonId = watch("tallaPantalonId");
  const tallaZapatosId = watch("tallaZapatosId");
  const tallaChaquetaId = watch("tallaChaquetaId");

  useEffect(() => {
    if (open) {
      setValue("tallaCamisaId", empleado.perfilFisico?.tallaCamisaId ?? 0);
      setValue("tallaPantalonId", empleado.perfilFisico?.tallaPantalonId ?? 0);
      setValue("tallaZapatosId", empleado.perfilFisico?.tallaZapatosId ?? 0);
      setValue("tallaChaquetaId", empleado.perfilFisico?.tallaChaquetaId ?? 0);
    }
  }, [open, empleado.perfilFisico, setValue]);

  const onSubmit: Parameters<typeof handleSubmit>[0] = (data) => {
    startTransition(async () => {
      setError(null);
      try {
        const payload = {
          perfilFisico: {
            tallaCamisaId: data.tallaCamisaId ? Number(data.tallaCamisaId) : null,
            tallaPantalonId: data.tallaPantalonId ? Number(data.tallaPantalonId) : null,
            tallaZapatosId: data.tallaZapatosId ? Number(data.tallaZapatosId) : null,
            tallaChaquetaId: data.tallaChaquetaId ? Number(data.tallaChaquetaId) : null,
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

        toast.success("Información de vestimenta actualizada exitosamente");
        setOpen(false);
        onGuardado();
      } catch {
        const msg = "Error al actualizar la información de vestimenta.";
        setError(msg);
        toast.error(msg);
      }
    });
  };

  const tipos = catalogos?.tiposPrenda ?? [];
  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const tipoCamisaId = tipos.find((tp) => normalizar(tp.nombre).includes("camisa"))?.id;
  const tipoPantalonId = tipos.find((tp) => normalizar(tp.nombre).includes("pantalon"))?.id;
  const tipoZapatoId = tipos.find((tp) => normalizar(tp.nombre).includes("zapato"))?.id;
  const tipoChaquetaId = tipos.find((tp) => normalizar(tp.nombre).includes("chaqueta"))?.id;

  // Las tallas ya no vienen en el catálogo inicial (Fase 2): se piden por
  // tipo de prenda, que es justo el filtro que el backend ya soportaba.
  const { opciones: camisas } = useCatalogoDependiente("tallas", tipoCamisaId, {
    valorActual: tallaCamisaId,
  });
  const { opciones: pantalones } = useCatalogoDependiente("tallas", tipoPantalonId, {
    valorActual: tallaPantalonId,
  });
  const { opciones: zapatos } = useCatalogoDependiente("tallas", tipoZapatoId, {
    valorActual: tallaZapatosId,
  });
  const { opciones: chaquetas } = useCatalogoDependiente("tallas", tipoChaquetaId, {
    valorActual: tallaChaquetaId,
  });

  const camisasGrouped = useMemo(() => groupByRegion(camisas), [camisas]);
  const pantalonesGrouped = useMemo(() => groupByRegion(pantalones), [pantalones]);
  const zapatosGrouped = useMemo(() => groupByRegion(zapatos), [zapatos]);
  const chaquetasGrouped = useMemo(() => groupByRegion(chaquetas), [chaquetas]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-xl p-0">
        <DialogTitle className="sr-only">Actualizar Información de Vestimenta</DialogTitle>

        <Card className="w-full h-full border-0 shadow-none flex flex-col gap-3">
          <CardHeader>
            <CardTitle>Vestimenta</CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <CardAction className="text-gray-600 mb-3">Datos De Vestimenta</CardAction>

            {error && (
              <div className="rounded bg-red-100 p-2 text-sm text-red-700 mb-3">{error}</div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="tallaCamisaId">Talla De Camisa</Label>
                <Select
                  value={tallaCamisaId ? String(tallaCamisaId) : ""}
                  onValueChange={(val) =>
                    setValue("tallaCamisaId", val ? Number(val) : (undefined as unknown as number))
                  }
                >
                  <SelectTrigger id="tallaCamisaId" className="w-full truncate" aria-invalid={!!errores.tallaCamisaId || undefined}>
                    <SelectValue placeholder="Seleccione una talla" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(camisasGrouped).map(([region, items]) => (
                      <SelectGroup key={region}>
                        <SelectLabel className="text-xs font-bold text-muted-foreground">
                          {region}
                        </SelectLabel>
                        {items.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.nombre}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {mensajeDe(errores.tallaCamisaId) && (
                  <p role="alert" className="text-sm text-destructive">
                    {mensajeDe(errores.tallaCamisaId)}
                  </p>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="tallaPantalonId">Talla De Pantalón</Label>
                <Select
                  value={tallaPantalonId ? String(tallaPantalonId) : ""}
                  onValueChange={(val) =>
                    setValue(
                      "tallaPantalonId",
                      val ? Number(val) : (undefined as unknown as number),
                    )
                  }
                >
                  <SelectTrigger id="tallaPantalonId" className="w-full truncate" aria-invalid={!!errores.tallaPantalonId || undefined}>
                    <SelectValue placeholder="Seleccione una talla" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(pantalonesGrouped).map(([region, items]) => (
                      <SelectGroup key={region}>
                        <SelectLabel className="text-xs font-bold text-muted-foreground">
                          {region}
                        </SelectLabel>
                        {items.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.nombre}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {mensajeDe(errores.tallaPantalonId) && (
                  <p role="alert" className="text-sm text-destructive">
                    {mensajeDe(errores.tallaPantalonId)}
                  </p>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="tallaZapatosId">Talla De Zapatos</Label>
                <Select
                  value={tallaZapatosId ? String(tallaZapatosId) : ""}
                  onValueChange={(val) =>
                    setValue("tallaZapatosId", val ? Number(val) : (undefined as unknown as number))
                  }
                >
                  <SelectTrigger id="tallaZapatosId" className="w-full truncate" aria-invalid={!!errores.tallaZapatosId || undefined}>
                    <SelectValue placeholder="Seleccione una talla" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(zapatosGrouped).map(([region, items]) => (
                      <SelectGroup key={region}>
                        <SelectLabel className="text-xs font-bold text-muted-foreground">
                          {region}
                        </SelectLabel>
                        {items.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.nombre}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {mensajeDe(errores.tallaZapatosId) && (
                  <p role="alert" className="text-sm text-destructive">
                    {mensajeDe(errores.tallaZapatosId)}
                  </p>
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor="tallaChaquetaId">Talla De Chaqueta</Label>
                <Select
                  value={tallaChaquetaId ? String(tallaChaquetaId) : ""}
                  onValueChange={(val) =>
                    setValue(
                      "tallaChaquetaId",
                      val ? Number(val) : (undefined as unknown as number),
                    )
                  }
                >
                  <SelectTrigger id="tallaChaquetaId" className="w-full truncate" aria-invalid={!!errores.tallaChaquetaId || undefined}>
                    <SelectValue placeholder="Seleccione una talla" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(chaquetasGrouped).map(([region, items]) => (
                      <SelectGroup key={region}>
                        <SelectLabel className="text-xs font-bold text-muted-foreground">
                          {region}
                        </SelectLabel>
                        {items.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.nombre}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {mensajeDe(errores.tallaChaquetaId) && (
                  <p role="alert" className="text-sm text-destructive">
                    {mensajeDe(errores.tallaChaquetaId)}
                  </p>
                )}
              </div>

              <Button className="w-full sm:col-span-2 cursor-pointer mt-3" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? "Actualizando Información" : "Actualizar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
