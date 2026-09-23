"use client";

/**
 * Sección "Perfil de salud" del mini-expediente del familiar
 * (`/familiares/registrar`): un solo objeto opcional (grupo sanguíneo +
 * alergias/patologías crónicas/discapacidades), paridad con el legado
 * `perfil_salud_familiar`. Mismo patrón visual (checkboxes agrupados por
 * categoría) que
 * `modules/personal/ui/dialogs/form-health-profile-update-dialog.tsx`.
 */
import type { UseFormReturn } from "react-hook-form";

import { Checkbox } from "@/shared/ui/components/checkbox";
import { Field } from "@/shared/ui/components/field";
import { Label } from "@/shared/ui/components/label";
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
      <h4 className="mb-2 text-sm font-semibold">{titulo}</h4>
      <div className="flex flex-col gap-2">
        {agrupados.map((grupo, idx) => (
          <div key={idx} className="mb-2">
            <h5 className="p-1 text-xs font-bold text-slate-700">{grupo.categoria.toUpperCase()}</h5>
            <div className="flex flex-col gap-1 pl-2">
              {grupo.datos.map((item) => (
                <div key={item.id} className="flex flex-row items-center gap-2">
                  <Checkbox
                    id={`${prefijoId}-${item.id}`}
                    checked={seleccionados.includes(item.id)}
                    onCheckedChange={() => onToggle(item.id)}
                  />
                  <Label htmlFor={`${prefijoId}-${item.id}`} className="cursor-pointer text-sm">
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
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Perfil de salud (opcional)</h3>

      <Field className="max-w-xs">
        <Label>Grupo sanguíneo</Label>
        <Select
          value={grupoSanguineoId ? String(grupoSanguineoId) : ""}
          onValueChange={(v) => form.setValue("perfilSalud.grupoSanguineoId", Number(v), { shouldValidate: true })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleccione un grupo sanguíneo" />
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GrupoChecklist
          titulo="Patologías crónicas"
          items={catalogos?.patologias ?? []}
          seleccionados={patologiasSel}
          onToggle={(id) => toggle("perfilSalud.patologiasCronicas", patologiasSel, id)}
          prefijoId="patologia-familiar"
        />
        <GrupoChecklist
          titulo="Discapacidades"
          items={catalogos?.discapacidades ?? []}
          seleccionados={discapacidadesSel}
          onToggle={(id) => toggle("perfilSalud.discapacidades", discapacidadesSel, id)}
          prefijoId="discapacidad-familiar"
        />
        <GrupoChecklist
          titulo="Alergias"
          items={catalogos?.alergias ?? []}
          seleccionados={alergiasSel}
          onToggle={(id) => toggle("perfilSalud.alergias", alergiasSel, id)}
          prefijoId="alergia-familiar"
        />
      </div>
    </div>
  );
}
