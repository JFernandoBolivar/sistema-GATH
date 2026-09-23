"use client";

/**
 * Paso 5 del wizard de registro: Datos De Salud (paridad con
 * `form-health_profile.tsx` del legado).
 *
 * El catálogo nuevo (`CatalogoItemSerializer`) solo trae `id`/`nombre`, sin
 * la categoría de cada patología/discapacidad/alergia, por lo que las
 * opciones se listan sin los subtítulos por categoría del legado.
 */
import { useMemo } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/components/form";
import { ScrollArea } from "@/shared/ui/components/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";

import type { CatalogoEmpleadoDTO, CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import { pasoHealthSchema, type PasoHealthType } from "../schema/schema-registro-pasos";

type CampoLista = Extract<
  FieldPath<PasoHealthType>,
  "perfil_salud.patologiaCronica" | "perfil_salud.alergias" | "perfil_salud.discapacidad"
>;

function agruparSaludPorCategoria(items: CatalogoEmpleadoDTO[]) {
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
    [] as { categoria: string; datos: CatalogoEmpleadoDTO[] }[],
  );
}

function ListaChequeo({
  titulo,
  name,
  opciones,
  control,
}: {
  titulo: string;
  name: CampoLista;
  opciones: CatalogoEmpleadoDTO[];
  control: ReturnType<typeof useForm<PasoHealthType>>["control"];
}) {
  const grupos = useMemo(() => agruparSaludPorCategoria(opciones), [opciones]);

  return (
    <div className="flex-1">
      <h2 className="font-bold mb-2">{titulo}</h2>
      {grupos.map((grupo, gIdx) => (
        <div key={gIdx} className="mb-2">
          <h2 className="p-2 text-sm font-bold">
            * {grupo.categoria.toUpperCase()}
          </h2>
          {grupo.datos.map((opcion) => (
            <div className="flex flex-col justify-start gap-2" key={opcion.id}>
              <FormField
                control={control}
                name={name}
                render={({ field }) => {
                  const actuales = Array.isArray(field.value) ? field.value : [];
                  return (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormControl>
                        <Checkbox
                          className="border-black"
                          checked={actuales.includes(opcion.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked ? [...actuales, opcion.id] : actuales.filter((x) => x !== opcion.id),
                            )
                          }
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">{opcion.nombre}</FormLabel>
                    </FormItem>
                  );
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PasoHealth({
  defaultValues,
  onSubmit,
  catalogos,
  isLoadingCatalogos,
}: {
  defaultValues: PasoHealthType;
  onSubmit: (values: PasoHealthType) => void;
  catalogos: CatalogosExpedienteDTO | null;
  isLoadingCatalogos: boolean;
}) {
  const form = useForm<PasoHealthType>({
    resolver: zodResolver(pasoHealthSchema),
    defaultValues,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle> Datos De Salud</CardTitle>
      </CardHeader>

      <CardContent>
        <CardAction className="text-gray-500">Paso 4: Perfil De Salud</CardAction>
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="gap-8">
              <FormField
                control={form.control}
                name="perfil_salud.grupoSanguineo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grupo Sanguineo </FormLabel>
                    <Select
                      value={field.value ? `${field.value}` : undefined}
                      onValueChange={(v) => field.onChange(Number.parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue
                            placeholder={`${isLoadingCatalogos ? "Cargando Grupos Sanguineos" : "Seleccione un Grupo Sanguineo"}`}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(catalogos?.gruposSanguineos ?? []).map((g) => (
                          <SelectItem key={g.id} value={`${g.id}`}>
                            {g.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ScrollArea className="h-80">
                <div className="flex gap-4">
                  <ListaChequeo
                    titulo="Patologias (Opcional)"
                    name="perfil_salud.patologiaCronica"
                    opciones={catalogos?.patologias ?? []}
                    control={form.control}
                  />
                  <ListaChequeo
                    titulo=" Dispacidades (Opcional)"
                    name="perfil_salud.discapacidad"
                    opciones={catalogos?.discapacidades ?? []}
                    control={form.control}
                  />
                  <ListaChequeo
                    titulo=" Alergias (Opcional)"
                    name="perfil_salud.alergias"
                    opciones={catalogos?.alergias ?? []}
                    control={form.control}
                  />
                </div>
              </ScrollArea>
              <Button className="w-full">Siguiente</Button>
            </form>
          </Form>
        </div>
      </CardContent>
    </Card>
  );
}
