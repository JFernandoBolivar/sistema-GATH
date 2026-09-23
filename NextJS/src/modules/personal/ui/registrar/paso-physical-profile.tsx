"use client";

/**
 * Paso 6 del wizard de registro: Vestimenta (paridad con
 * `form-physical_profile.tsx` del legado). Las tallas se cargan por tipo de
 * prenda (Camisa, Pantalón, Zapato, Chaqueta) con el filtro
 * `tipo_prenda_id` del backend.
 */
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";

import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/components/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";

import type { CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import { getCatalogoDependienteAction } from "../../infrastructure/actions/registro-actions";
import { pasoPhysicalProfileSchema, type PasoPhysicalProfileType } from "../schema/schema-registro-pasos";

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function useTallasPorPrenda(catalogos: CatalogosExpedienteDTO | null, prenda: string) {
  const tipo = catalogos?.tiposPrenda.find((t) => normalizar(t.nombre).startsWith(prenda));
  const { data, isLoading } = useSWR(tipo ? ["tallas", tipo.id] : null, () =>
    getCatalogoDependienteAction("tallas", tipo!.id),
  );
  return { tallas: data ?? [], isLoading: !catalogos || isLoading };
}

function CampoTalla({
  control,
  name,
  label,
  tallas,
  isLoading,
  className,
}: {
  control: ReturnType<typeof useForm<PasoPhysicalProfileType>>["control"];
  name: FieldPath<PasoPhysicalProfileType>;
  label: string;
  tallas: { id: number; nombre: string }[];
  isLoading: boolean;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? field.value.toString() : ""}>
            <FormControl>
              <SelectTrigger className="w-full truncate">
                <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione una talla"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {tallas.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function PasoPhysicalProfile({
  defaultValues,
  onSubmit,
  catalogos,
}: {
  defaultValues: PasoPhysicalProfileType;
  onSubmit: (values: PasoPhysicalProfileType) => void;
  catalogos: CatalogosExpedienteDTO | null;
}) {
  const form = useForm<PasoPhysicalProfileType>({
    resolver: zodResolver(pasoPhysicalProfileSchema),
    defaultValues,
  });
  const camisas = useTallasPorPrenda(catalogos, "camisa");
  const pantalones = useTallasPorPrenda(catalogos, "pantalon");
  const zapatos = useTallasPorPrenda(catalogos, "zapato");
  const chaquetas = useTallasPorPrenda(catalogos, "chaqueta");

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Vestimenta</CardTitle>
      </CardHeader>
      <CardContent>
        <CardAction className="text-gray-600">Paso 5: Datos De Vestimenta</CardAction>
        <Form {...form}>
          <form className="grid grid-cols-2 gap-2" onSubmit={form.handleSubmit(onSubmit)}>
            <CampoTalla control={form.control} name="perfil_fisico.tallaCamisa" label="Talla De Camisa" {...camisas} />
            <CampoTalla control={form.control} name="perfil_fisico.tallaPantalon" label="Talla De Pantalón" {...pantalones} />
            <CampoTalla
              control={form.control}
              name="perfil_fisico.tallaZapatos"
              label="Talla De Zapatos"
              className="col-span-2"
              {...zapatos}
            />
            <CampoTalla control={form.control} name="perfil_fisico.tallaChaqueta" label="Talla De Chaqueta" {...chaquetas} />
            <Button className="w-full col-span-2">Siguiente</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
