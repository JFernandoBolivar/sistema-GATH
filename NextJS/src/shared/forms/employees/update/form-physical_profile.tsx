"use client";

import { getTallas } from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { PhysicalProfileType } from "@/shared/schemas/employees/register/schema-physical_profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TallaItem } from "@/app/types/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import Loading from "@/app/(protected)/dashboard/gestion-trabajadores/components/loading/loading";
import {
  PhysicalProfileUpdateType,
  schemaPhysicalProfileUpdate,
} from "@/shared/schemas/employees/update/schema-physical_profile";
import { useSearchStore } from "@/hooks/use-search-params";

function groupByRegion(tallas: TallaItem[]) {
  return tallas.reduce(
    (acc, item) => {
      const codigo = item.region.codigo;
      if (!acc[codigo]) acc[codigo] = [];
      acc[codigo].push(item);
      return acc;
    },
    {} as Record<string, TallaItem[]>,
  );
}

type Props = {
  defaultValues: PhysicalProfileType;
  mutate: (key: string[]) => void;
  mutateKey?: string;
    updateInfoEmployee: (...args: any[]) => Promise<{ success: boolean; message: string }>;
  idEmployee: string;
};
export default function FormUpdatePhysical({
  defaultValues,
  mutate,
  mutateKey = "api/empleados",
  updateInfoEmployee,
  idEmployee,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(schemaPhysicalProfileUpdate),
    defaultValues: {
      perfil_fisico: {
        tallaCamisa: defaultValues.perfil_fisico?.tallaCamisa ?? 0,
        tallaPantalon: defaultValues.perfil_fisico?.tallaPantalon ?? 0,
        tallaZapatos: defaultValues.perfil_fisico?.tallaZapatos ?? 0,
        tallaChaqueta: defaultValues.perfil_fisico?.tallaChaqueta ?? 0,
      },
    },
  });
  const { data: tallas, isLoading } = useSWR("tallas", async () => await getTallas());

  const camisas = useMemo(() => tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Camisa") ?? [], [tallas]);
  const pantalones = useMemo(() => tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Pantalón") ?? [], [tallas]);
  const zapatos = useMemo(() => tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Zapato") ?? [], [tallas]);
  const chaquetas = useMemo(() => tallas?.data?.filter((t) => t.tipo_prenda.categoria === "Chaqueta") ?? [], [tallas]);

  const camisasGrouped = useMemo(() => groupByRegion(camisas), [camisas]);
  const pantalonesGrouped = useMemo(() => groupByRegion(pantalones), [pantalones]);
  const zapatosGrouped = useMemo(() => groupByRegion(zapatos), [zapatos]);
  const chaquetasGrouped = useMemo(() => groupByRegion(chaquetas), [chaquetas]);

  const searchParams = useSearchStore((state) => state.searchParams);
  const onSubmitFormity = (values: PhysicalProfileUpdateType) => {
    startTransition(async () => {
      const response = await updateInfoEmployee(values, idEmployee);
      if (response.success) {
        toast.success(response.message);
        mutate([mutateKey, searchParams]);
      } else {
        toast.error(response.message);
      }
    });
  };
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Vestimenta</CardTitle>
      </CardHeader>
      <CardContent>
        <CardAction className="text-gray-600">Datos De Vestimenta</CardAction>
        {isPending ? (
          <Loading promiseMessage="Actualizando Información" />
        ) : (
          <Form {...form}>
            <form className="grid grid-cols-2 gap-2 space-y-2" onSubmit={form.handleSubmit(onSubmitFormity)}>
              <FormField
                control={form.control}
                name="perfil_fisico.tallaCamisa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Talla De Camisa</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? field.value.toString() : ""}>
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione una talla"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(camisasGrouped).map(([region, items]) => (
                          <SelectGroup key={region}>
                            <SelectLabel className="text-xs font-bold text-muted-foreground">{region}</SelectLabel>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id.toString()}>{item.valor}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="perfil_fisico.tallaPantalon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Talla De Pantalón</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? field.value.toString() : ""}>
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione una talla"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(pantalonesGrouped).map(([region, items]) => (
                          <SelectGroup key={region}>
                            <SelectLabel className="text-xs font-bold text-muted-foreground">{region}</SelectLabel>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id.toString()}>{item.valor}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="perfil_fisico.tallaZapatos"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Talla De Zapatos</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? field.value.toString() : ""}>
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione una talla"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(zapatosGrouped).map(([region, items]) => (
                          <SelectGroup key={region}>
                            <SelectLabel className="text-xs font-bold text-muted-foreground">{region}</SelectLabel>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id.toString()}>{item.valor}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="perfil_fisico.tallaChaqueta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Talla De Chaqueta</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? field.value.toString() : ""}>
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione una talla"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(chaquetasGrouped).map(([region, items]) => (
                          <SelectGroup key={region}>
                            <SelectLabel className="text-xs font-bold text-muted-foreground">{region}</SelectLabel>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id.toString()}>{item.valor}</SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button className="w-full col-span-2" disabled={isPending}>
                {isPending ? "Actualizando Información" : "Actualizar"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
