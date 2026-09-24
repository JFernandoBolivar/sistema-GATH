"use client";

/**
 * Sección "Información Académica" del familiar:
 * Réplica visual y de comportamiento de crear-familiar.tsx del legado:
 * fieldset border-blue-700, legend con BookAIcon, Switch de "Más Detalles",
 * Carrera, Mención, Capacitación e Institución con soporte de "Otra".
 */
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { BookAIcon } from "lucide-react";

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
import { Switch } from "@/shared/ui/components/switch";

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
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const nivelAcademicoId = form.watch("formacionAcademica.nivelAcademicoId") ?? undefined;
  const carreraId = form.watch("formacionAcademica.carreraId") ?? undefined;
  const mencionId = form.watch("formacionAcademica.mencionId") ?? undefined;
  const institucionId = form.watch("formacionAcademica.institucionId") ?? undefined;

  const nivelSeleccionado = catalogos?.nivelesAcademicos.find((n) => n.id === Number(nivelAcademicoId));
  const esNoPosee = esNivelNoPoseeFamiliar(nivelSeleccionado?.nombre);

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
    <fieldset className="border grid grid-cols-2 gap-4 col-span-2 p-2 border-blue-700 rounded-sm">
      <legend className="flex gap-2 text-blue-700 font-bold items-center">
        Información Academica <BookAIcon className="size-5" />
      </legend>

      <div className="col-span-2 flex flex-col gap-2">
        <Field>
          <Label className="cursor-pointer">Nivel Académico</Label>
          <Select
            value={nivelAcademicoId ? String(nivelAcademicoId) : ""}
            onValueChange={(v) => {
              form.setValue("formacionAcademica.nivelAcademicoId", Number(v), { shouldValidate: true });
              form.setValue("formacionAcademica.carreraId", undefined);
              form.setValue("formacionAcademica.mencionId", undefined);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccione un Nivel Academico" />
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

        {!(nivelAcademicoId === 1 || nivelAcademicoId === 2 || esNoPosee || !nivelAcademicoId) && (
          <div className="flex flex-row gap-2 justify-end items-center">
            <Label className="cursor-pointer">Mas Detalles De Formacion Academica</Label>
            <Switch
              checked={showMoreDetails}
              onCheckedChange={setShowMoreDetails}
              className="cursor-pointer"
            />
          </div>
        )}
      </div>

      {showMoreDetails && (
        <>
          <div className="col-span-2 md:col-span-1 flex flex-col gap-2">
            <Field>
              <Label>Carrera (Opcional)</Label>
              <SelectDependienteFamiliar
                tipo="carreras"
                padreId={nivelAcademicoId}
                value={carreraId}
                onChange={(id) => {
                  form.setValue("formacionAcademica.carreraId", id);
                  form.setValue("formacionAcademica.mencionId", undefined);
                }}
                respaldo={catalogos?.carreras ?? []}
                permitirOtra={Number(nivelAcademicoId) > 0 && !esNoPosee}
              />
              {carreraId === ID_OTRA_FAMILIAR && (
                <Input
                  className="mt-1"
                  placeholder="Nueva carrera..."
                  {...form.register("formacionAcademica.nuevaCarreraNombre")}
                />
              )}
              {errores?.nuevaCarreraNombre && <p role="alert" className="text-sm text-destructive">{errores.nuevaCarreraNombre.message}</p>}
            </Field>
          </div>

          <div className="col-span-2 md:col-span-1 flex flex-col gap-2">
            <Field>
              <Label>Mención (Opcional)</Label>
              <SelectDependienteFamiliar
                tipo="menciones"
                padreId={carreraId}
                value={mencionId}
                onChange={(id) => form.setValue("formacionAcademica.mencionId", id)}
                respaldo={catalogos?.menciones ?? []}
                permitirOtra={Number(carreraId) > 0}
              />
              {mencionId === ID_OTRA_FAMILIAR && (
                <Input
                  className="mt-1"
                  placeholder="Nueva mención..."
                  {...form.register("formacionAcademica.nuevaMencionNombre")}
                />
              )}
              {errores?.nuevaMencionNombre && <p role="alert" className="text-sm text-destructive">{errores.nuevaMencionNombre.message}</p>}
            </Field>
          </div>

          <div className="col-span-2 md:col-span-1 flex flex-col gap-2">
            <Field>
              <Label className="cursor-pointer">Capacitación (Opcional)</Label>
              <Input
                type="text"
                placeholder="Capacitado En..."
                {...form.register("formacionAcademica.capacitacion")}
              />
            </Field>
          </div>

          <div className="col-span-2 md:col-span-1 flex flex-col gap-2">
            <Field>
              <Label>
                Institución{" "}
                {(Number(carreraId) > 0) ? (
                  <span className="text-destructive">*</span>
                ) : (
                  "(Opcional)"
                )}
              </Label>
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
                <Input
                  className="mt-1"
                  placeholder="Nueva institución..."
                  {...form.register("formacionAcademica.nuevaInstitucionNombre")}
                />
              )}
              {(errores?.nuevaInstitucionNombre || errores?.institucionId) && (
                <p role="alert" className="text-sm text-destructive">
                  {(errores?.nuevaInstitucionNombre ?? errores?.institucionId)?.message}
                </p>
              )}
            </Field>
          </div>
        </>
      )}
    </fieldset>
  );
}
