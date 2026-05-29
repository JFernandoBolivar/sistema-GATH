import {
  getAllergies,
  getBloodGroup,
  getDisability,
  getPatologys,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { HealthType } from "@/shared/schemas/employees/register/schema-health_profile";
import { allergies, DisabilitysType, PatologysType } from "@/app/types/types";
import { Button } from "@/components/ui/button";
import useSWR, { useSWRConfig } from "swr";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import Loading from "@/app/(protected)/dashboard/gestion-trabajadores/components/loading/loading";
import {
  HealthUpdateType,
  schemaHealthProfileUpdate,
} from "@/shared/schemas/employees/update/schema-health_profile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearchStore } from "@/hooks/use-search-params";

type Props = {
  defaultValues: HealthType;
  mutate: (key: string[]) => void;
  mutateKey?: string;
    updateInfoEmployee: (...args: any[]) => Promise<{ success: boolean; message: string }>;
  idEmployee: string;
};

export default function FormUpdateHealth({
  defaultValues,
  idEmployee,
  mutate,
  mutateKey = "api/empleados",
  updateInfoEmployee,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schemaHealthProfileUpdate),
    defaultValues,
  });
  const { data: patology, isLoading: isLoadingPatology } = useSWR(
    "patology",
    async () => await getPatologys(),
  );
  const { data: bloodGroup, isLoading: isLoadingBloodGroup } = useSWR(
    "blood",
    async () => await getBloodGroup(),
  );
  const { data: disability, isLoading: isLoadingDisability } = useSWR(
    "disability",
    async () => await getDisability(),
  );
  const { data: allergies, isLoading: isLoadingAllergies } = useSWR(
    "allergies",
    async () => await getAllergies(),
  );
  const allergiesGroupList = useMemo(() => {
    const data = allergies?.data;
    if (!data) return [];
    return allergies.data.reduce(
      (acc, item) => {
        const categoriaNombre = item.categoria.nombre_categoria;
        let grupo = acc.find((g) => g.categoria === categoriaNombre);
        if (!grupo) {
          grupo = { categoria: categoriaNombre, datos: [] };
          acc.push(grupo);
        }
        grupo.datos.push(item);
        return acc;
      },
      [] as { categoria: string; datos: allergies[] }[],
    );
  }, [allergies]);
  const searchParams = useSearchStore((state) => state.searchParams);
  const onSubmitFormity = (values: HealthUpdateType) => {
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
  const disabilityGroupList = useMemo(() => {
    const data = disability?.data; // Extrae aquí
    if (!data) return [];
    return disability.data.reduce(
      (acc, item) => {
        const categoriaNombre = item.categoria.nombre_categoria;
        let grupo = acc.find((g) => g.categoria === categoriaNombre);
        if (!grupo) {
          grupo = { categoria: categoriaNombre, datos: [] };
          acc.push(grupo);
        }
        grupo.datos.push(item);
        return acc;
      },
      [] as { categoria: string; datos: DisabilitysType[] }[],
    );
  }, [disability]);

  const patologyGroupList = useMemo(() => {
    const data = patology?.data;
    if (!data) return [];
    return patology.data.reduce(
      (acc, item) => {
        const categoriaNombre = item.categoria.nombre_categoria;
        let grupo = acc.find((g) => g.categoria === categoriaNombre);
        if (!grupo) {
          grupo = { categoria: categoriaNombre, datos: [] };
          acc.push(grupo);
        }
        grupo.datos.push(item);
        return acc;
      },
      [] as { categoria: string; datos: PatologysType[] }[],
    );
  }, [patology]);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle> Datos De Salud</CardTitle>
        </CardHeader>

        <CardContent>
          <CardAction className="text-gray-500">Perfil De Salud</CardAction>
          {isPending ? (
            <Loading promiseMessage="Actualizando Información" />
          ) : (
            <div>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmitFormity)}
                  className="space-y-8"
                >
                  <FormField
                    control={form.control}
                    name="perfil_salud.grupoSanguineo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grupo Sanguineo </FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(Number.parseInt(values));
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={`${isLoadingBloodGroup ? "Cargando Grupos Sanguineos" : "Seleccione un Grupo Sanguineo"}`}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {bloodGroup?.data.map((bloodGroup, i) => (
                              <SelectItem key={i} value={`${bloodGroup.id}`}>
                                {bloodGroup.GrupoSanguineo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <ScrollArea className="h-80 col-span-2">
                    <div className="flex flex-row justify-around gap-4 ">
                      <div>
                        <h2 className="font-bold">Patologias (Opcional)</h2>
                        {patologyGroupList.map((patologys, index) => (
                          <div key={index}>
                            <h2 className="p-2 text-sm font-bold">
                              * {patologys.categoria.toUpperCase()}
                            </h2>
                            {patologys.datos.map((patologyItem, i) => (
                              <div
                                className="flex flex-col justify-start gap-2  "
                                key={i}
                              >
                                <FormField
                                  control={form.control}
                                  name="perfil_salud.patologiaCronica"
                                  render={({ field }) => {
                                    const currentValues = Array.isArray(
                                      field.value,
                                    )
                                      ? field.value
                                      : [];
                                    if (isLoadingPatology) {
                                      return <Loading />;
                                    }
                                    return (
                                      <FormItem className="flex flex-row items-center space-y-2 ">
                                        <FormControl>
                                          <Checkbox
                                            className="border-black"
                                            checked={currentValues.includes(
                                              patologyItem.id,
                                            )}
                                            onCheckedChange={(checked) => {
                                              const newValue = checked
                                                ? [
                                                    ...currentValues,
                                                    patologyItem.id,
                                                  ]
                                                : currentValues.filter(
                                                    (id) =>
                                                      id !== patologyItem.id,
                                                  );

                                              field.onChange(newValue);
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel
                                          key={index}
                                          className="cursor-pointer"
                                        >
                                          {patologyItem.patologia}
                                        </FormLabel>
                                      </FormItem>
                                    );
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div>
                        <h2 className="font-bold"> Dispacidades (Opcional)</h2>
                        {disabilityGroupList.map((disability, index) => (
                          <div key={index}>
                            <h2 className="p-2 text-sm font-bold">
                              * {disability.categoria.toUpperCase()}
                            </h2>
                            {disability.datos.map((disabilityItem, i) => (
                              <div
                                className="flex flex-col justify-start gap-2 "
                                key={i}
                              >
                                <FormField
                                  control={form.control}
                                  name={`perfil_salud.discapacidad`}
                                  render={({ field }) => {
                                    const currentValues = Array.isArray(
                                      field.value,
                                    )
                                      ? field.value
                                      : [];
                                    if (isLoadingDisability) {
                                      return <Loading />;
                                    }
                                    return (
                                      <FormItem className="flex flex-row space-y-2">
                                        <FormLabel className="order-2">
                                          {disabilityItem.discapacidad}
                                        </FormLabel>
                                        <FormControl>
                                          <Checkbox
                                            className="order-1 border-black"
                                            onCheckedChange={(checked) => {
                                              const newValue = checked
                                                ? [
                                                    ...currentValues,
                                                    disabilityItem.id,
                                                  ]
                                                : currentValues.filter(
                                                    (id) =>
                                                      id !== disabilityItem.id,
                                                  );

                                              field.onChange(newValue);
                                            }}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    );
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div>
                        <h2 className="font-bold"> Alergias (Opcional)</h2>
                        {allergiesGroupList.map((allergies, index) => (
                          <div key={index}>
                            <h2 className="p-2 text-sm font-bold">
                              * {allergies.categoria.toUpperCase()}
                            </h2>
                            {allergies.datos.map((disabilityItem, i) => (
                              <div
                                className="flex flex-col justify-start gap-2 "
                                key={i}
                              >
                                <FormField
                                  control={form.control}
                                  name={`perfil_salud.alergias`}
                                  render={({ field }) => {
                                    const currentValues = Array.isArray(
                                      field.value,
                                    )
                                      ? field.value
                                      : [];
                                    if (isLoadingDisability) {
                                      return <Loading />;
                                    }
                                    return (
                                      <FormItem className="flex flex-row space-y-2">
                                        <FormLabel className="order-2">
                                          {disabilityItem.alergia}
                                        </FormLabel>
                                        <FormControl>
                                          <Checkbox
                                            className="order-1 border-black"
                                            onCheckedChange={(checked) => {
                                              const newValue = checked
                                                ? [
                                                    ...currentValues,
                                                    disabilityItem.id,
                                                  ]
                                                : currentValues.filter(
                                                    (id) =>
                                                      id !== disabilityItem.id,
                                                  );

                                              field.onChange(newValue);
                                            }}
                                          />
                                        </FormControl>
                                      </FormItem>
                                    );
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>

                  <Button className="w-full" disabled={isPending}>
                    {isPending ? "Actualizando Información" : "Actualizar"}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
