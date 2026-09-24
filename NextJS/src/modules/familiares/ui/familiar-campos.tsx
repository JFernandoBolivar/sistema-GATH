"use client";

/**
 * Campos del formulario de identidad/parentesco de una carga familiar.
 * Usado en el diálogo de edición (familiar-form-dialog.tsx) desde el Sheet de detalle.
 */
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Calendar } from "@/shared/ui/components/calendar";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";
import { Switch } from "@/shared/ui/components/switch";

import type { CatalogosFamiliarDTO } from "../application/dtos/familiar-dto";
import type { FamiliarFormType } from "./schema/schema-familiar";
import { CatalogoFamiliarSelect } from "./catalogo-familiar-select";

export function FamiliarCampos({
  form,
  catalogos,
}: {
  form: UseFormReturn<FamiliarFormType>;
  catalogos: CatalogosFamiliarDTO | null;
}) {
  const [down, setDown] = useState(false);
  const fechaNac = form.watch("fechaNacimiento");

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Cédula del familiar */}
        <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-3">
          <Label htmlFor="cedulaFamiliar" className="cursor-pointer">
            Cédula del familiar
          </Label>
          <Input
            id="cedulaFamiliar"
            disabled={down}
            placeholder={
              down
                ? "Se tomara la cedula del trabajador como representante del menor de edad"
                : ""
            }
            {...form.register("cedulaFamiliar")}
          />
          <div className="flex justify-end items-center gap-2 pt-1">
            <Label htmlFor="switch-menor-9-edit" className="text-xs text-muted-foreground cursor-pointer">
              ¿El Familiar Es Menor De 9 años?
            </Label>
            <Switch
              id="switch-menor-9-edit"
              checked={down}
              onCheckedChange={(bool) => {
                setDown(bool);
                form.setValue("cedulaFamiliar", bool ? "" : "");
              }}
              className="cursor-pointer"
            />
          </div>
          {form.formState.errors.cedulaFamiliar && (
            <p role="alert" className="text-sm text-destructive">
              {form.formState.errors.cedulaFamiliar.message}
            </p>
          )}
        </div>

        <Field data-invalid={!!form.formState.errors.primerNombre}>
          <Label htmlFor="primerNombre">Primer nombre *</Label>
          <Input id="primerNombre" {...form.register("primerNombre")} aria-invalid={!!form.formState.errors.primerNombre} />
          {form.formState.errors.primerNombre && <p role="alert" className="text-sm text-destructive">{form.formState.errors.primerNombre.message}</p>}
        </Field>

        <Field>
          <Label htmlFor="segundoNombre">Segundo nombre</Label>
          <Input id="segundoNombre" {...form.register("segundoNombre")} />
        </Field>

        <Field data-invalid={!!form.formState.errors.primerApellido}>
          <Label htmlFor="primerApellido">Primer apellido *</Label>
          <Input id="primerApellido" {...form.register("primerApellido")} aria-invalid={!!form.formState.errors.primerApellido} />
          {form.formState.errors.primerApellido && <p role="alert" className="text-sm text-destructive">{form.formState.errors.primerApellido.message}</p>}
        </Field>

        <Field>
          <Label htmlFor="segundoApellido">Segundo apellido</Label>
          <Input id="segundoApellido" {...form.register("segundoApellido")} />
        </Field>

        <Field data-invalid={!!form.formState.errors.parentescoId}>
          <Label htmlFor="parentescoId">Parentesco *</Label>
          <CatalogoFamiliarSelect
            id="parentescoId"
            value={form.watch("parentescoId")}
            onChange={(v) => form.setValue("parentescoId", v, { shouldValidate: true })}
            options={catalogos?.parentescos ?? []}
            placeholder="Seleccione parentesco"
          />
          {form.formState.errors.parentescoId && <p role="alert" className="text-sm text-destructive">{form.formState.errors.parentescoId.message}</p>}
        </Field>

        <Field data-invalid={!!form.formState.errors.fechaNacimiento} className="flex flex-col">
          <Label>Fecha de nacimiento *</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="font-light w-full justify-between"
              >
                {fechaNac ? (
                  format(new Date(fechaNac + "T00:00:00"), "dd/MM/yyyy")
                ) : (
                  <span>Selecciona una fecha</span>
                )}
                <CalendarIcon className="ml-auto size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                selected={fechaNac ? new Date(fechaNac + "T00:00:00") : undefined}
                mode="single"
                onSelect={(date) => {
                  if (date) {
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, "0");
                    const dd = String(date.getDate()).padStart(2, "0");
                    form.setValue("fechaNacimiento", `${yyyy}-${mm}-${dd}`, { shouldValidate: true });
                  }
                }}
                disabled={(date: Date) =>
                  date > new Date() || date < new Date("1900-01-01")
                }
                captionLayout="dropdown"
              />
            </PopoverContent>
          </Popover>
          {form.formState.errors.fechaNacimiento && <p role="alert" className="text-sm text-destructive">{form.formState.errors.fechaNacimiento.message}</p>}
        </Field>

        <Field data-invalid={!!form.formState.errors.sexoId}>
          <Label htmlFor="sexoId">Sexo *</Label>
          <CatalogoFamiliarSelect
            id="sexoId"
            value={form.watch("sexoId")}
            onChange={(v) => form.setValue("sexoId", v, { shouldValidate: true })}
            options={catalogos?.sexos ?? []}
            placeholder="Seleccione sexo"
          />
          {form.formState.errors.sexoId && <p role="alert" className="text-sm text-destructive">{form.formState.errors.sexoId.message}</p>}
        </Field>

        <Field className="md:col-span-2 lg:col-span-3">
          <Label htmlFor="observaciones">Observaciones</Label>
          <Input id="observaciones" {...form.register("observaciones")} />
        </Field>
      </div>

      <div className="flex items-center gap-6 pt-2">
        <div className="flex items-center gap-2">
          <Switch
            id="mismoEnte-edit"
            checked={form.watch("mismoEnte")}
            onCheckedChange={(val) => form.setValue("mismoEnte", val)}
          />
          <Label htmlFor="mismoEnte-edit" className="cursor-pointer text-sm">
            ¿El Familiar Trabaja En Este Ente?
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="heredero-edit"
            checked={form.watch("heredero")}
            onCheckedChange={(val) => form.setValue("heredero", val)}
          />
          <Label htmlFor="heredero-edit" className="cursor-pointer text-sm">
            ¿El Familiar Es Heredero?
          </Label>
        </div>
      </div>
    </>
  );
}
