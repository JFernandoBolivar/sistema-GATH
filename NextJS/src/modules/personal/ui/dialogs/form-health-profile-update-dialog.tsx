"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Checkbox } from "@/shared/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../../application/dtos/empleado-dto";
import { actualizarEmpleadoAction } from "../../infrastructure/actions/personal-actions";

interface FormHealthProfileUpdateDialogProps {
  empleado: EmpleadoDTO;
  catalogos: CatalogosExpedienteDTO | null;
  onGuardado: () => void;
  triggerClassName?: string;
  triggerLabel?: string;
}

export default function FormHealthProfileUpdateDialog({
  empleado,
  catalogos,
  onGuardado,
  triggerClassName = "cursor-pointer bg-blue-700 hover:bg-blue-900 text-white",
  triggerLabel = "Actualizar",
}: FormHealthProfileUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [selectedPatologias, setSelectedPatologias] = useState<number[]>(
    empleado.perfilSalud?.patologiasCronicas ?? [],
  );
  const [selectedDiscapacidades, setSelectedDiscapacidades] = useState<number[]>(
    empleado.perfilSalud?.discapacidades ?? [],
  );
  const [selectedAlergias, setSelectedAlergias] = useState<number[]>(
    empleado.perfilSalud?.alergias ?? [],
  );

  const { handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      grupoSanguineoId: empleado.perfilSalud?.grupoSanguineoId ?? undefined,
    },
  });

  const grupoSanguineoId = watch("grupoSanguineoId");

  const togglePatologia = (id: number) => {
    setSelectedPatologias((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleDiscapacidad = (id: number) => {
    setSelectedDiscapacidades((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAlergia = (id: number) => {
    setSelectedAlergias((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onSubmit = (data: any) => {
    startTransition(async () => {
      setError(null);
      try {
        const payload = {
          perfilSalud: {
            grupoSanguineoId: data.grupoSanguineoId ? Number(data.grupoSanguineoId) : null,
            patologiasCronicas: selectedPatologias,
            discapacidades: selectedDiscapacidades,
            alergias: selectedAlergias,
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
        setError("Error al actualizar la información de salud.");
      }
    });
  };

  const grupos = catalogos?.gruposSanguineos ?? [];
  const patologias = catalogos?.patologias ?? [];
  const discapacidades = catalogos?.discapacidades ?? [];
  const alergias = catalogos?.alergias ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Actualizar Información de Salud</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded bg-red-100 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="grupoSanguineoId">Grupo Sanguíneo</Label>
            <Select
              value={grupoSanguineoId ? String(grupoSanguineoId) : ""}
              onValueChange={(val) =>
                setValue("grupoSanguineoId", val ? Number(val) : (undefined as any))
              }
            >
              <SelectTrigger id="grupoSanguineoId">
                <SelectValue placeholder="Seleccione un Grupo Sanguíneo" />
              </SelectTrigger>
              <SelectContent>
                {grupos.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-72 rounded-md border p-3">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Patologías */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-gray-800">
                  Patologías (Opcional)
                </h3>
                <div className="space-y-2">
                  {patologias.map((p) => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`patologia-${p.id}`}
                        checked={selectedPatologias.includes(p.id)}
                        onCheckedChange={() => togglePatologia(p.id)}
                      />
                      <Label
                        htmlFor={`patologia-${p.id}`}
                        className="cursor-pointer text-xs font-normal"
                      >
                        {p.nombre}
                      </Label>
                    </div>
                  ))}
                  {patologias.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin patologías registradas</p>
                  )}
                </div>
              </div>

              {/* Discapacidades */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-gray-800">
                  Discapacidades (Opcional)
                </h3>
                <div className="space-y-2">
                  {discapacidades.map((d) => (
                    <div key={d.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`discapacidad-${d.id}`}
                        checked={selectedDiscapacidades.includes(d.id)}
                        onCheckedChange={() => toggleDiscapacidad(d.id)}
                      />
                      <Label
                        htmlFor={`discapacidad-${d.id}`}
                        className="cursor-pointer text-xs font-normal"
                      >
                        {d.nombre}
                      </Label>
                    </div>
                  ))}
                  {discapacidades.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin discapacidades registradas</p>
                  )}
                </div>
              </div>

              {/* Alergias */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-gray-800">
                  Alergias (Opcional)
                </h3>
                <div className="space-y-2">
                  {alergias.map((a) => (
                    <div key={a.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`alergia-${a.id}`}
                        checked={selectedAlergias.includes(a.id)}
                        onCheckedChange={() => toggleAlergia(a.id)}
                      />
                      <Label
                        htmlFor={`alergia-${a.id}`}
                        className="cursor-pointer text-xs font-normal"
                      >
                        {a.nombre}
                      </Label>
                    </div>
                  ))}
                  {alergias.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin alergias registradas</p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-900 text-white hover:bg-blue-800"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Actualizar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
