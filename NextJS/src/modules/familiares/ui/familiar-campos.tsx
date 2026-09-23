"use client";

/**
 * Campos del formulario de identidad/parentesco de una carga familiar.
 * Extraído para reutilizarse tanto en el diálogo de alta/edición
 * (`familiar-form-dialog.tsx`, usado desde el Sheet de detalle) como en la
 * página propia de registro (`/familiares/registrar`, paridad con la ruta
 * separada del legado `familiares/agregar-familiar/page.tsx`).
 */
import type { UseFormReturn } from "react-hook-form";

import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";

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
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field>
          <Label htmlFor="cedulaFamiliar">Cédula del familiar</Label>
          <Input id="cedulaFamiliar" {...form.register("cedulaFamiliar")} />
        </Field>
        <Field data-invalid={!!form.formState.errors.primerNombre}>
          <Label htmlFor="primerNombre">Primer nombre</Label>
          <Input id="primerNombre" {...form.register("primerNombre")} aria-invalid={!!form.formState.errors.primerNombre} />
          {form.formState.errors.primerNombre && <p role="alert" className="text-sm text-destructive">{form.formState.errors.primerNombre.message}</p>}
        </Field>
        <Field>
          <Label htmlFor="segundoNombre">Segundo nombre</Label>
          <Input id="segundoNombre" {...form.register("segundoNombre")} />
        </Field>
        <Field data-invalid={!!form.formState.errors.primerApellido}>
          <Label htmlFor="primerApellido">Primer apellido</Label>
          <Input id="primerApellido" {...form.register("primerApellido")} aria-invalid={!!form.formState.errors.primerApellido} />
          {form.formState.errors.primerApellido && <p role="alert" className="text-sm text-destructive">{form.formState.errors.primerApellido.message}</p>}
        </Field>
        <Field>
          <Label htmlFor="segundoApellido">Segundo apellido</Label>
          <Input id="segundoApellido" {...form.register("segundoApellido")} />
        </Field>
        <Field data-invalid={!!form.formState.errors.parentescoId}>
          <Label htmlFor="parentescoId">Parentesco</Label>
          <CatalogoFamiliarSelect
            id="parentescoId"
            value={form.watch("parentescoId")}
            onChange={(v) => form.setValue("parentescoId", v, { shouldValidate: true })}
            options={catalogos?.parentescos ?? []}
            placeholder="Seleccione parentesco"
          />
          {form.formState.errors.parentescoId && <p role="alert" className="text-sm text-destructive">{form.formState.errors.parentescoId.message}</p>}
        </Field>
        <Field data-invalid={!!form.formState.errors.fechaNacimiento}>
          <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
          <Input type="date" id="fechaNacimiento" {...form.register("fechaNacimiento")} aria-invalid={!!form.formState.errors.fechaNacimiento} />
          {form.formState.errors.fechaNacimiento && <p role="alert" className="text-sm text-destructive">{form.formState.errors.fechaNacimiento.message}</p>}
        </Field>
        <Field data-invalid={!!form.formState.errors.sexoId}>
          <Label htmlFor="sexoId">Sexo</Label>
          <CatalogoFamiliarSelect
            id="sexoId"
            value={form.watch("sexoId")}
            onChange={(v) => form.setValue("sexoId", v, { shouldValidate: true })}
            options={catalogos?.sexos ?? []}
            placeholder="Seleccione sexo"
          />
          {form.formState.errors.sexoId && <p role="alert" className="text-sm text-destructive">{form.formState.errors.sexoId.message}</p>}
        </Field>
        <Field>
          <Label htmlFor="observaciones">Observaciones</Label>
          <Input id="observaciones" {...form.register("observaciones")} />
        </Field>
      </div>
      <div className="flex items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("mismoEnte")} className="size-4" /> Mismo ente
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register("heredero")} className="size-4" /> Heredero
        </label>
      </div>
    </>
  );
}
