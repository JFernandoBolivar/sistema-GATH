"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/shared/ui/components/dialog";
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

function agruparSaludPorCategoria(items: NonNullable<CatalogosExpedienteDTO["patologias"]>) {
  return items.reduce(
    (acc, item) => {
      const categoria = item.categoriaNombre || "General";
      let grupo = acc.find((g) => g.categoria === categoria);
      if (!grupo) {
        grupo = { categoria, datos: [] };
        acc.push(grupo);
      }
      grupo.datos.push(item);
      return acc;
    },
    [] as { categoria: string; datos: NonNullable<CatalogosExpedienteDTO["patologias"]> }[],
  );
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

  useEffect(() => {
    if (open) {
      setSelectedPatologias(empleado.perfilSalud?.patologiasCronicas ?? []);
      setSelectedDiscapacidades(empleado.perfilSalud?.discapacidades ?? []);
      setSelectedAlergias(empleado.perfilSalud?.alergias ?? []);
      setValue("grupoSanguineoId", empleado.perfilSalud?.grupoSanguineoId ?? undefined);
    }
  }, [open, empleado.perfilSalud, setValue]);

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

  const onSubmit: Parameters<typeof handleSubmit>[0] = (data) => {
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
          const msg = (result as { error: string }).error;
          setError(msg);
          toast.error(msg);
          return;
        }

        toast.success("Información de salud actualizada exitosamente");
        setOpen(false);
        onGuardado();
      } catch {
        const msg = "Error al actualizar la información de salud.";
        setError(msg);
        toast.error(msg);
      }
    });
  };

  const grupos = catalogos?.gruposSanguineos ?? [];
  const patologias = catalogos?.patologias ?? [];
  const discapacidades = catalogos?.discapacidades ?? [];
  const alergias = catalogos?.alergias ?? [];

  const patologiasAgrupadas = useMemo(() => agruparSaludPorCategoria(patologias), [patologias]);
  const discapacidadesAgrupadas = useMemo(
    () => agruparSaludPorCategoria(discapacidades),
    [discapacidades],
  );
  const alergiasAgrupadas = useMemo(() => agruparSaludPorCategoria(alergias), [alergias]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl p-0">
        <DialogTitle className="sr-only">Datos De Salud</DialogTitle>

        <Card className="w-full h-full border-0 shadow-none flex flex-col gap-3">
          <CardHeader>
            <CardTitle> Datos De Salud</CardTitle>
          </CardHeader>

          <CardContent className="pt-0">
            <CardAction className="text-gray-500 mb-3">Perfil De Salud</CardAction>

            {error && (
              <div className="rounded bg-red-100 p-2 text-sm text-red-700 mb-3">{error}</div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="gap-4 flex flex-col">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="grupoSanguineoId">Grupo Sanguineo </Label>
                <Select
                  value={grupoSanguineoId ? String(grupoSanguineoId) : ""}
                  onValueChange={(val) =>
                    setValue(
                      "grupoSanguineoId",
                      val ? Number(val) : (undefined as unknown as number),
                    )
                  }
                >
                  <SelectTrigger id="grupoSanguineoId" className="w-full truncate">
                    <SelectValue placeholder="Seleccione un Grupo Sanguineo" />
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

              <div className="max-h-[55vh] overflow-y-auto w-full border rounded-md p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Patologías */}
                  <div className="flex-1">
                    <h2 className="font-bold mb-2">Patologias (Opcional)</h2>
                    <div className="flex flex-col gap-2">
                      {patologiasAgrupadas.map((grupo, idx) => (
                        <div key={idx} className="mb-2">
                          <h3 className="p-1 text-xs font-bold text-slate-700">
                            * {grupo.categoria.toUpperCase()}
                          </h3>
                          <div className="flex flex-col gap-1 pl-2">
                            {grupo.datos.map((p) => (
                              <div key={p.id} className="flex flex-row items-center gap-2">
                                <Checkbox
                                  id={`patologia-${p.id}`}
                                  className="border-black"
                                  checked={selectedPatologias.includes(p.id)}
                                  onCheckedChange={() => togglePatologia(p.id)}
                                />
                                <Label
                                  htmlFor={`patologia-${p.id}`}
                                  className="cursor-pointer text-sm"
                                >
                                  {p.nombre}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {patologias.length === 0 && (
                        <p className="text-xs text-muted-foreground">Sin patologías registradas</p>
                      )}
                    </div>
                  </div>

                  {/* Discapacidades */}
                  <div className="flex-1">
                    <h2 className="font-bold mb-2">Discapacidades (Opcional)</h2>
                    <div className="flex flex-col gap-2">
                      {discapacidadesAgrupadas.map((grupo, idx) => (
                        <div key={idx} className="mb-2">
                          <h3 className="p-1 text-xs font-bold text-slate-700">
                            * {grupo.categoria.toUpperCase()}
                          </h3>
                          <div className="flex flex-col gap-1 pl-2">
                            {grupo.datos.map((d) => (
                              <div key={d.id} className="flex flex-row items-center gap-2">
                                <Checkbox
                                  id={`discapacidad-${d.id}`}
                                  className="border-black"
                                  checked={selectedDiscapacidades.includes(d.id)}
                                  onCheckedChange={() => toggleDiscapacidad(d.id)}
                                />
                                <Label
                                  htmlFor={`discapacidad-${d.id}`}
                                  className="cursor-pointer text-sm"
                                >
                                  {d.nombre}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {discapacidades.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Sin discapacidades registradas
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Alergias */}
                  <div className="flex-1">
                    <h2 className="font-bold mb-2">Alergias (Opcional)</h2>
                    <div className="flex flex-col gap-2">
                      {alergiasAgrupadas.map((grupo, idx) => (
                        <div key={idx} className="mb-2">
                          <h3 className="p-1 text-xs font-bold text-slate-700">
                            * {grupo.categoria.toUpperCase()}
                          </h3>
                          <div className="flex flex-col gap-1 pl-2">
                            {grupo.datos.map((a) => (
                              <div key={a.id} className="flex flex-row items-center gap-2">
                                <Checkbox
                                  id={`alergia-${a.id}`}
                                  className="border-black"
                                  checked={selectedAlergias.includes(a.id)}
                                  onCheckedChange={() => toggleAlergia(a.id)}
                                />
                                <Label
                                  htmlFor={`alergia-${a.id}`}
                                  className="cursor-pointer text-sm"
                                >
                                  {a.nombre}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {alergias.length === 0 && (
                        <p className="text-xs text-muted-foreground">Sin alergias registradas</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Button className="w-full cursor-pointer mt-4" disabled={isPending}>
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
