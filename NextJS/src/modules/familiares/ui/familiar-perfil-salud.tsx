"use client";

/**
 * Sección "Datos De Salud" del familiar:
 * Réplica visual y de comportamiento de crear-familiar.tsx del legado:
 * fieldset border-red-700, legend con HeartPulse, Grupo Sanguíneo y
 * ScrollArea h-80 con las 3 columnas (Patologías, Discapacidades, Alergias)
 * agrupadas por categoría.
 */
import type { UseFormReturn } from "react-hook-form";
import { HeartPulse } from "lucide-react";

import { Checkbox } from "@/shared/ui/components/checkbox";
import { Field } from "@/shared/ui/components/field";
import { Label } from "@/shared/ui/components/label";
import { ScrollArea } from "@/shared/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { CatalogoFamiliarDTO, CatalogosFamiliarDTO } from "../application/dtos/familiar-dto";
import type { FamiliarFormType } from "./schema/schema-familiar";

function agruparPorCategoria(items: CatalogoFamiliarDTO[]) {
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
    [] as { categoria: string; datos: CatalogoFamiliarDTO[] }[],
  );
}

function GrupoChecklist({
  titulo,
  items,
  seleccionados,
  onToggle,
  prefijoId,
}: {
  titulo: string;
  items: CatalogoFamiliarDTO[];
  seleccionados: number[];
  onToggle: (id: number) => void;
  prefijoId: string;
}) {
  const agrupados = agruparPorCategoria(items);
  return (
    <div>
      <h2 className="font-bold text-sm mb-2">{titulo}</h2>
      <div className="flex flex-col gap-2">
        {agrupados.map((grupo, idx) => (
          <div key={idx} className="mb-2">
            <h3 className="p-1 text-sm font-bold">* {grupo.categoria.toUpperCase()}</h3>
            <div className="flex flex-col gap-1.5 pl-2">
              {grupo.datos.map((item) => (
                <div key={item.id} className="flex flex-row items-center gap-2">
                  <Checkbox
                    id={`${prefijoId}-${item.id}`}
                    checked={seleccionados.includes(item.id)}
                    onCheckedChange={() => onToggle(item.id)}
                  />
                  <Label htmlFor={`${prefijoId}-${item.id}`} className="cursor-pointer text-sm font-normal">
                    {item.nombre}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground">Sin registros</p>}
      </div>
    </div>
  );
}

export function FamiliarPerfilSalud({
  form,
  catalogos,
}: {
  form: UseFormReturn<FamiliarFormType>;
  catalogos: CatalogosFamiliarDTO | null;
}) {
  const grupoSanguineoId = form.watch("perfilSalud.grupoSanguineoId") ?? undefined;
  const alergiasSel = form.watch("perfilSalud.alergias") ?? [];
  const patologiasSel = form.watch("perfilSalud.patologiasCronicas") ?? [];
  const discapacidadesSel = form.watch("perfilSalud.discapacidades") ?? [];

  const toggle = (
    campo: "perfilSalud.alergias" | "perfilSalud.patologiasCronicas" | "perfilSalud.discapacidades",
    actuales: number[],
    id: number,
  ) => {
    const siguiente = actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id];
    form.setValue(campo, siguiente, { shouldValidate: true });
  };

  const errores = form.formState.errors.perfilSalud as { grupoSanguineoId?: { message?: string } } | undefined;

  return (
    <fieldset className="border grid grid-cols-2 gap-4 col-span-2 p-2 border-red-700 rounded-sm">
      <legend className="flex gap-2 text-red-700 font-bold items-center">
        Datos De Salud <HeartPulse className="size-5" />
      </legend>

      <Field className="col-span-2">
        <Label>Grupo Sanguíneo</Label>
        <Select
          value={grupoSanguineoId ? String(grupoSanguineoId) : ""}
          onValueChange={(v) => form.setValue("perfilSalud.grupoSanguineoId", Number(v), { shouldValidate: true })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccione un Grupo Sanguineo" />
          </SelectTrigger>
          <SelectContent>
            {(catalogos?.gruposSanguineos ?? []).map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                {g.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errores?.grupoSanguineoId && <p role="alert" className="text-sm text-destructive">{errores.grupoSanguineoId.message}</p>}
      </Field>

      <ScrollArea className="h-80 w-full col-span-2 border rounded-sm p-3 bg-muted/10">
        <div className="flex flex-row justify-around gap-4">
          <div className="flex-1">
            <GrupoChecklist
              titulo="Patologías (Opcional)"
              items={catalogos?.patologias ?? []}
              seleccionados={patologiasSel}
              onToggle={(id) => toggle("perfilSalud.patologiasCronicas", patologiasSel, id)}
              prefijoId="patologia-familiar"
            />
          </div>
          <div className="flex-1">
            <GrupoChecklist
              titulo="Discapacidades (Opcional)"
              items={catalogos?.discapacidades ?? []}
              seleccionados={discapacidadesSel}
              onToggle={(id) => toggle("perfilSalud.discapacidades", discapacidadesSel, id)}
              prefijoId="discapacidad-familiar"
            />
          </div>
          <div className="flex-1">
            <GrupoChecklist
              titulo="Alergias (Opcional)"
              items={catalogos?.alergias ?? []}
              seleccionados={alergiasSel}
              onToggle={(id) => toggle("perfilSalud.alergias", alergiasSel, id)}
              prefijoId="alergia-familiar"
            />
          </div>
        </div>
      </ScrollArea>
    </fieldset>
  );
}
