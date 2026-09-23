"use client";

/**
 * Sección "Formación académica" del mini-expediente del familiar
 * (`/familiares/registrar`): a diferencia de `modules/personal` (arreglo de
 * múltiples formaciones vía `useFieldArray`), aquí es UN SOLO objeto
 * opcional (paridad con el legado `FamilyCreateSerializer`). Mismo patrón de
 * cascada Nivel -> Carrera -> Mención + opción "Otra" que
 * `modules/personal/ui/dialogs/form-academic-training-update-dialog.tsx`.
 */
import type { UseFormReturn } from "react-hook-form";

import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
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
import { useCatalogoDependienteFamiliar } from "./use-catalogo-dependiente-familiar";
import { ID_OTRA_FAMILIAR, esNivelNoPoseeFamiliar } from "./catalogo-otra-familiar";

function SelectDependienteFamiliar({
  tipo,
  padreId,
  value,
  onChange,
  respaldo,
  permitirOtra,
}: {
  tipo: "carreras" | "menciones";
  padreId: number | undefined;
  value: number | undefined;
  onChange: (id: number) => void;
  respaldo: CatalogoFamiliarDTO[];
  permitirOtra: boolean;
}) {
  const { opciones, isLoading } = useCatalogoDependienteFamiliar(tipo, padreId, { valorActual: value, respaldo });
  return (
    <Select value={value ? String(value) : ""} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione"} />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.nombre}
          </SelectItem>
        ))}
        {permitirOtra && <SelectItem value={String(ID_OTRA_FAMILIAR)}>Otra</SelectItem>}
      </SelectContent>
    </Select>
  );
}

export function FamiliarFormacionAcademica({
  form,
  catalogos,
}: {
  form: UseFormReturn<FamiliarFormType>;
  catalogos: CatalogosFamiliarDTO | null;
}) {
  const nivelAcademicoId = form.watch("formacionAcademica.nivelAcademicoId") ?? undefined;
  const carreraId = form.watch("formacionAcademica.carreraId") ?? undefined;
  const mencionId = form.watch("formacionAcademica.mencionId") ?? undefined;
  const institucionId = form.watch("formacionAcademica.institucionId") ?? undefined;

  const errores = form.formState.errors.formacionAcademica as
    | {
        nivelAcademicoId?: { message?: string };
        nuevaCarreraNombre?: { message?: string };
        nuevaMencionNombre?: { message?: string };
        nuevaInstitucionNombre?: { message?: string };
        institucionId?: { message?: string };
      }
    | undefined;

  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">Formación académica (opcional)</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Field>
          <Label>Nivel académico</Label>
          <Select
            value={nivelAcademicoId ? String(nivelAcademicoId) : ""}
            onValueChange={(v) => {
              form.setValue("formacionAcademica.nivelAcademicoId", Number(v), { shouldValidate: true });
              form.setValue("formacionAcademica.carreraId", undefined);
              form.setValue("formacionAcademica.mencionId", undefined);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {(catalogos?.nivelesAcademicos ?? []).map((n) => (
                <SelectItem key={n.id} value={String(n.id)}>
                  {n.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errores?.nivelAcademicoId && <p role="alert" className="text-sm text-destructive">{errores.nivelAcademicoId.message}</p>}
        </Field>

        <Field>
          <Label>Carrera (opcional)</Label>
          <SelectDependienteFamiliar
            tipo="carreras"
            padreId={nivelAcademicoId}
            value={carreraId}
            onChange={(id) => {
              form.setValue("formacionAcademica.carreraId", id);
              form.setValue("formacionAcademica.mencionId", undefined);
            }}
            respaldo={catalogos?.carreras ?? []}
            permitirOtra={
              Number(nivelAcademicoId) > 0 &&
              !esNivelNoPoseeFamiliar(catalogos?.nivelesAcademicos.find((n) => n.id === Number(nivelAcademicoId))?.nombre)
            }
          />
          {carreraId === ID_OTRA_FAMILIAR && (
            <Input className="mt-1" placeholder="Nueva carrera..." {...form.register("formacionAcademica.nuevaCarreraNombre")} />
          )}
          {errores?.nuevaCarreraNombre && <p role="alert" className="text-sm text-destructive">{errores.nuevaCarreraNombre.message}</p>}
        </Field>

        <Field>
          <Label>Mención (opcional)</Label>
          <SelectDependienteFamiliar
            tipo="menciones"
            padreId={carreraId}
            value={mencionId}
            onChange={(id) => form.setValue("formacionAcademica.mencionId", id)}
            respaldo={catalogos?.menciones ?? []}
            permitirOtra={Number(carreraId) > 0}
          />
          {mencionId === ID_OTRA_FAMILIAR && (
            <Input className="mt-1" placeholder="Nueva mención..." {...form.register("formacionAcademica.nuevaMencionNombre")} />
          )}
          {errores?.nuevaMencionNombre && <p role="alert" className="text-sm text-destructive">{errores.nuevaMencionNombre.message}</p>}
        </Field>

        <Field>
          <Label>Institución (opcional)</Label>
          <Select
            value={institucionId ? String(institucionId) : ""}
            onValueChange={(v) => form.setValue("formacionAcademica.institucionId", Number(v), { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              {(catalogos?.instituciones ?? []).map((inst) => (
                <SelectItem key={inst.id} value={String(inst.id)}>
                  {inst.nombre}
                </SelectItem>
              ))}
              <SelectItem value={String(ID_OTRA_FAMILIAR)}>Otra</SelectItem>
            </SelectContent>
          </Select>
          {institucionId === ID_OTRA_FAMILIAR && (
            <Input className="mt-1" placeholder="Nueva institución..." {...form.register("formacionAcademica.nuevaInstitucionNombre")} />
          )}
          {(errores?.nuevaInstitucionNombre || errores?.institucionId) && (
            <p role="alert" className="text-sm text-destructive">
              {(errores?.nuevaInstitucionNombre ?? errores?.institucionId)?.message}
            </p>
          )}
        </Field>
      </div>
    </div>
  );
}
