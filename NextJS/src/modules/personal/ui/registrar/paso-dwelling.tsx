"use client";

/**
 * Paso 7 del wizard de registro: Datos Socio-económicos / Vivienda (paridad
 * con `form-dwelling.tsx` del legado). Municipios y parroquias se cargan en
 * cascada con los filtros `estado_id` / `municipio_id` del backend.
 */
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Combobox } from "@/shared/ui/components/combobox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/form";
import { Input } from "@/shared/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";

import type { CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import { getCatalogoDependienteAction } from "../../infrastructure/actions/registro-actions";
import { pasoDwellingSchema, type PasoDwellingType } from "../schema/schema-registro-pasos";

export function PasoDwelling({
  defaultValues,
  onSubmit,
  catalogos,
  isLoadingCatalogos,
  isPending,
}: {
  defaultValues: PasoDwellingType;
  onSubmit: (values: PasoDwellingType) => void;
  catalogos: CatalogosExpedienteDTO | null;
  isLoadingCatalogos: boolean;
  isPending: boolean;
}) {
  const form = useForm<PasoDwellingType>({
    resolver: zodResolver(pasoDwellingSchema),
    defaultValues,
  });
  const estadoId = useWatch({ control: form.control, name: "datos_vivienda.estado_id" });
  const municipioId = useWatch({ control: form.control, name: "datos_vivienda.municipio_id" });

  const { data: municipios, isLoading: isLoadingMunicipios } = useSWR(
    estadoId > 0 ? ["municipios", estadoId] : null,
    () => getCatalogoDependienteAction("municipios", estadoId),
  );
  const { data: parroquias, isLoading: isLoadingParroquias } = useSWR(
    municipioId > 0 ? ["parroquias", municipioId] : null,
    () => getCatalogoDependienteAction("parroquias", municipioId),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos Socio-economicos</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        <CardAction className="text-gray-500">Paso 6: Datos De Vivienda</CardAction>
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="datos_vivienda.estado_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado *</FormLabel>
                    <FormControl>
                      <Combobox
                        options={(catalogos?.estados ?? []).map((e) => ({ value: `${e.id}`, label: e.nombre }))}
                        value={field.value ? `${field.value}` : ""}
                        onChange={(value) => {
                          field.onChange(Number.parseInt(value));
                          form.setValue("datos_vivienda.municipio_id", 0);
                          form.setValue("datos_vivienda.parroquia", 0);
                        }}
                        disabled={isLoadingCatalogos}
                        placeholder={isLoadingCatalogos ? "Cargando Estados" : "Seleccione un Estado"}
                        searchPlaceholder="Buscar estado..."
                      />
                    </FormControl>
                    <FormDescription>Esta Información Sera Publica</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="datos_vivienda.municipio_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Municipio *</FormLabel>
                    <FormControl>
                      <Combobox
                        options={(municipios ?? []).map((m) => ({ value: `${m.id}`, label: m.nombre }))}
                        value={field.value ? `${field.value}` : ""}
                        onChange={(value) => {
                          field.onChange(Number.parseInt(value));
                          form.setValue("datos_vivienda.parroquia", 0);
                        }}
                        disabled={isLoadingMunicipios}
                        placeholder={isLoadingMunicipios ? "Cargando Municipios" : "Seleccione un Municpio"}
                        searchPlaceholder="Buscar municipio..."
                      />
                    </FormControl>
                    <FormDescription>Esta Información Sera Publica</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="datos_vivienda.parroquia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parroquia *</FormLabel>
                    <FormControl>
                      <Combobox
                        options={(parroquias ?? []).map((p) => ({ value: `${p.id}`, label: p.nombre }))}
                        value={field.value ? `${field.value}` : ""}
                        onChange={(value) => field.onChange(Number.parseInt(value))}
                        disabled={isLoadingParroquias}
                        placeholder={isLoadingParroquias ? "Cargando Parroquias" : "Seleccione una Parroquia"}
                        searchPlaceholder="Buscar parroquia..."
                      />
                    </FormControl>
                    <FormDescription>Esta Información Sera Publica</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="datos_vivienda.condicion_vivienda_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condicion De Vivienda *</FormLabel>
                    <Select
                      value={field.value ? `${field.value}` : undefined}
                      onValueChange={(v) => field.onChange(Number.parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue
                            placeholder={`${isLoadingCatalogos ? "Cargando Condiciones De Vivienda" : "Seleccione una Condicion De Vivienda"}`}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(catalogos?.condicionesVivienda ?? []).map((c) => (
                          <SelectItem key={c.id} value={`${c.id}`}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Esta Información Sera Publica</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="datos_vivienda.direccion_exacta"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Direccion Exacta *</FormLabel>
                    <FormControl>
                      <Input placeholder="Calle, Casa, Apartamento, Sector" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="datos_vivienda.codigo_postal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código Postal *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number.parseInt(v))}
                      value={field.value ? `${field.value}` : undefined}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue
                            placeholder={isLoadingCatalogos ? "Cargando Códigos Postales" : "Seleccione un Código Postal"}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(estadoId > 0 ? catalogos?.codigosPostales ?? [] : []).map((cp) => (
                          <SelectItem key={cp.id} value={`${cp.id}`}>
                            {cp.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button className="w-full col-span-2" disabled={isPending}>
                Siguiente
              </Button>
            </form>
          </Form>
        </div>
      </CardContent>
    </Card>
  );
}
