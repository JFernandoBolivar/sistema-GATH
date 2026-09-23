"use client";

/**
 * Paso 2 del wizard de registro: Formación Académica (paridad con
 * `form-academic_training.tsx` del legado). Cascada Nivel Académico ->
 * Carrera -> Mención con los filtros del backend.
 */
import { useFieldArray, useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Cross, Trash, X } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Combobox } from "@/shared/ui/components/combobox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/components/form";
import { Label } from "@/shared/ui/components/label";
import { ScrollArea } from "@/shared/ui/components/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";

import type { CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import { pasoAcademySchema, type PasoAcademyType } from "../schema/schema-registro-pasos";
import { useCatalogoDependiente } from "../use-catalogo-dependiente";

const filaVacia = {
  nivel_Academico_id: 0,
  carrera_id: undefined,
  mencion_id: undefined,
  institucion_id: undefined,
};

function AcademicRow({
  index,
  remove,
  catalogos,
  isLoadingCatalogos,
}: {
  index: number;
  remove: (index: number) => void;
  catalogos: CatalogosExpedienteDTO | null;
  isLoadingCatalogos: boolean;
}) {
  const { control, setValue } = useFormContext<PasoAcademyType>();
  const watchedCarreraId = useWatch({ control, name: `formacion_academica.${index}.carrera_id` });
  const hasCarrera = watchedCarreraId != null && watchedCarreraId > 0;

  const watchedNivelId = useWatch({ control, name: `formacion_academica.${index}.nivel_Academico_id` });
  const { opciones: carreras, isLoading: isLoadingCarrera } = useCatalogoDependiente("carreras", watchedNivelId);
  const { opciones: menciones, isLoading: isLoadingMencion } = useCatalogoDependiente(
    "menciones",
    hasCarrera ? watchedCarreraId : null,
  );

  return (
    <div className="flex flex-row gap-5 items-start w-full">
      <FormField
        control={control}
        name={`formacion_academica.${index}.nivel_Academico_id`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{index + 1}. Nivel Academico</FormLabel>
            <Select
              onValueChange={(v) => {
                field.onChange(Number.parseInt(v));
                setValue(`formacion_academica.${index}.carrera_id`, undefined);
                setValue(`formacion_academica.${index}.mencion_id`, undefined);
              }}
              value={field.value ? field.value.toString() : ""}
            >
              <FormControl>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder={isLoadingCatalogos ? "Cargando..." : "Seleccione"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {(catalogos?.nivelesAcademicos ?? []).map((nivel) => (
                  <SelectItem key={nivel.id} value={`${nivel.id}`}>
                    {nivel.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`formacion_academica.${index}.carrera_id`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Carrera (Opcional)</FormLabel>
            <FormControl>
              <Combobox
                className="w-80"
                options={carreras.map((c) => ({ value: `${c.id}`, label: c.nombre }))}
                value={field.value?.toString() ?? ""}
                onChange={(v) => {
                  field.onChange(Number(v));
                  setValue(`formacion_academica.${index}.mencion_id`, undefined);
                }}
                placeholder={isLoadingCarrera ? "Cargando..." : "Seleccione"}
                searchPlaceholder="Buscar carrera..."
                disabled={isLoadingCarrera}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`formacion_academica.${index}.mencion_id`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mención (Opcional)</FormLabel>
            <FormControl>
              <Combobox
                className="w-80"
                options={menciones.map((m) => ({ value: `${m.id}`, label: m.nombre }))}
                value={field.value?.toString() ?? ""}
                onChange={(v) => field.onChange(Number.parseInt(v))}
                placeholder={isLoadingMencion ? "Cargando..." : "Seleccione"}
                searchPlaceholder="Buscar mención..."
                disabled={isLoadingMencion}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`formacion_academica.${index}.institucion_id`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Institución {hasCarrera ? <span className="text-red-500">*</span> : "(Opcional)"}
            </FormLabel>
            <FormControl>
              <Combobox
                className="w-80"
                options={(catalogos?.instituciones ?? []).map((i) => ({ value: i.id.toString(), label: i.nombre }))}
                value={field.value?.toString() ?? ""}
                onChange={(v) => field.onChange(Number(v))}
                placeholder={isLoadingCatalogos ? "Cargando..." : "Seleccione"}
                searchPlaceholder="Buscar institución..."
                disabled={isLoadingCatalogos}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-medium leading-none invisible">X</span>
        <Button
          type="button"
          variant={"destructive"}
          size="icon"
          className={`${index === 0 ? "invisible" : ""} cursor-pointer`}
          onClick={() => remove(index)}
          aria-label={`Quitar formación académica ${index + 1}`}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

export function PasoAcademic({
  defaultValues,
  onSubmit,
  catalogos,
  isLoadingCatalogos,
}: {
  defaultValues: PasoAcademyType;
  onSubmit: (values: PasoAcademyType) => void;
  catalogos: CatalogosExpedienteDTO | null;
  isLoadingCatalogos: boolean;
}) {
  const form = useForm<PasoAcademyType>({
    resolver: zodResolver(pasoAcademySchema),
    defaultValues,
    mode: "onChange",
  });
  const { fields, append, remove } = useFieldArray({ name: "formacion_academica", control: form.control });
  const isError = Object.keys(form.formState.errors).length === 0;

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Formacion Academica</CardTitle>
      </CardHeader>

      <CardContent>
        <CardAction className="text-gray-600">Paso 2: Información Academica</CardAction>
      </CardContent>

      <CardContent className="">
        <Form {...form}>
          <form className="flex flex-col gap-2" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex justify-end gap-2 mr-4 items-center ">
              <div className="flex flex-col items-center justify-center">
                <Label htmlFor="clean">Limpiar</Label>
                <Button
                  id="clean"
                  variant={"destructive"}
                  type="button"
                  className="cursor-pointer"
                  onClick={() => form.reset({ formacion_academica: [{ ...filaVacia }] })}
                >
                  <Trash />
                </Button>
              </div>
              {isError && (
                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="add">Agregar</Label>
                  <Button id="add" variant={"default"} type="button" className="cursor-pointer" onClick={() => append({ ...filaVacia })}>
                    <Cross />
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="h-60 rounded-md w-full border p-2">
              <h1 className="text-gray-600">Opcional si no posee formación académica</h1>
              {fields.map((field, index) => (
                <AcademicRow
                  key={field.id}
                  index={index}
                  remove={remove}
                  catalogos={catalogos}
                  isLoadingCatalogos={isLoadingCatalogos}
                />
              ))}
            </ScrollArea>
            {!isError && (
              <Badge
                className="animate-pulse text-lg font-bold text-white w-full flex justify-center items-center text-center h-auto py-2 whitespace-normal"
                variant={"destructive"}
              >
                Por favor, corrija los campos marcados o complete la información pendiente antes de agregar una nueva
                formación academica.
              </Badge>
            )}
            <Button className="mt-4 w-full cursor-pointer">Siguiente</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
