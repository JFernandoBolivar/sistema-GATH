"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../../application/dtos/empleado-dto";
import { actualizarEmpleadoAction } from "../../infrastructure/actions/personal-actions";

interface FormPhysicalProfileUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
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

  const { handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      tallaCamisaId: empleado.perfilFisico?.tallaCamisaId ?? undefined,
      tallaPantalonId: empleado.perfilFisico?.tallaPantalonId ?? undefined,
      tallaZapatosId: empleado.perfilFisico?.tallaZapatosId ?? undefined,
      tallaChaquetaId: empleado.perfilFisico?.tallaChaquetaId ?? undefined,
    },
  });

  const tallaCamisaId = watch("tallaCamisaId");
  const tallaPantalonId = watch("tallaPantalonId");
  const tallaZapatosId = watch("tallaZapatosId");
  const tallaChaquetaId = watch("tallaChaquetaId");

  const onSubmit = (data: any) => {
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
          setError((result as { error: string }).error);
          return;
        }

        setOpen(false);
        onGuardado();
      } catch {
        setError("Error al actualizar la información de vestimenta.");
      }
    });
  };

  const tallas = catalogos?.tallas ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg p-0 border-none bg-transparent shadow-none">
        <DialogTitle className="sr-only">Actualizar Información de Vestimenta</DialogTitle>

        <Card className="flex flex-col gap-3">
          <CardHeader>
            <CardTitle>Vestimenta</CardTitle>
          </CardHeader>

          <CardContent>
            <CardAction className="text-gray-600 mb-3">Datos De Vestimenta</CardAction>

            {error && (
              <div className="rounded bg-red-100 p-2 text-sm text-red-700 mb-3">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tallaCamisaId">Talla De Camisa</Label>
                <Select
                  value={tallaCamisaId ? String(tallaCamisaId) : ""}
                  onValueChange={(val) => setValue("tallaCamisaId", val ? Number(val) : (undefined as any))}
                >
                  <SelectTrigger id="tallaCamisaId" className="w-full">
                    <SelectValue placeholder="Seleccione una talla" />
                  </SelectTrigger>
                  <SelectContent>
                    {tallas.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tallaPantalonId">Talla De Pantalón</Label>
                <Select
                  value={tallaPantalonId ? String(tallaPantalonId) : ""}
                  onValueChange={(val) => setValue("tallaPantalonId", val ? Number(val) : (undefined as any))}
                >
                  <SelectTrigger id="tallaPantalonId" className="w-full">
                    <SelectValue placeholder="Seleccione una talla" />
                  </SelectTrigger>
                  <SelectContent>
                    {tallas.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="tallaZapatosId">Talla De Zapatos</Label>
                <Select
                  value={tallaZapatosId ? String(tallaZapatosId) : ""}
                  onValueChange={(val) => setValue("tallaZapatosId", val ? Number(val) : (undefined as any))}
                >
                  <SelectTrigger id="tallaZapatosId" className="w-full">
                    <SelectValue placeholder="Seleccione una talla" />
                  </SelectTrigger>
                  <SelectContent>
                    {tallas.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="tallaChaquetaId">Talla De Chaqueta</Label>
                <Select
                  value={tallaChaquetaId ? String(tallaChaquetaId) : ""}
                  onValueChange={(val) => setValue("tallaChaquetaId", val ? Number(val) : (undefined as any))}
                >
                  <SelectTrigger id="tallaChaquetaId" className="w-full">
                    <SelectValue placeholder="Seleccione una talla" />
                  </SelectTrigger>
                  <SelectContent>
                    {tallas.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full col-span-2 cursor-pointer mt-3"
                disabled={isPending}
              >
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
