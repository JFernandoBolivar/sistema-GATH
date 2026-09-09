import InputForm from "@/components/input-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import {
  getCoordination,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
} from "../../api/getInfoRac";
import upgradeDirectionGeneralCoordAction from "../../ubicacion-administrativa/actualizar-ubicacion/actions/upgradeDirectionGeneralCoord";
import {
  SchemaUpgradeDireccionGeneralCoord,
  schemaUpgradeDireccionGeneralCoord,
} from "../../ubicacion-administrativa/actualizar-ubicacion/schema/schemaUpdateDireccionGeneralCoord";
import Loading from "../loading/loading";

export default function UpdateDireccionGeneralCoordin() {
  const [isPending, startTransition] = useTransition();

  const [dependencyId, setDependencyId] = useState<number>(0);
  const { data: directionGeneral, isLoading: isLoadingDirectionGeneral } =
    useSWR(
      dependencyId ? ["directionGeneral", dependencyId] : null,
      async () => await getDirectionGeneralById(dependencyId),
    );
  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
  );

  const form = useForm<SchemaUpgradeDireccionGeneralCoord>({
    defaultValues: {
      Codigo: "",
      dependenciaId: 0,
      direccion_general: "",
      id: 0,
    },
    resolver: zodResolver(schemaUpgradeDireccionGeneralCoord),
  });
  const onSubmit = (values: SchemaUpgradeDireccionGeneralCoord) => {
    startTransition(async () => {
      const response = await upgradeDirectionGeneralCoordAction(values);
      if (response.success) {
        toast.success(response.message);
      } else {
        toast.error(response.message);
      }
    });
  };

  return (
    <>
      {isPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="gap-5">
            <FormField
              control={form.control}
              name="dependenciaId"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nivel</FormLabel>
                  <FormControl>
                    <Combobox
                      options={(dependency?.data ?? []).map((dependencia) => ({
                        value: `${dependencia.id}`,
                        label: dependencia.dependencia,
                      }))}
                      value={field.value ? `${field.value}` : ""}
                      onChange={(value) => {
                        field.onChange(Number.parseInt(value));
                        setDependencyId(Number.parseInt(value));
                      }}
                      placeholder={
                        isLoadingDependency ? "Cargando Nivel" : "Seleccione un Nivel"
                      }
                      searchPlaceholder="Buscar nivel..."
                      disabled={isLoadingDependency}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                  <FormControl>
                    <Combobox
                      options={(directionGeneral?.data ?? []).map((general) => ({
                        value: `${general.id}`,
                        label: `${general.Codigo}-${general.direccion_general}`,
                      }))}
                      value={field.value ? `${field.value}` : ""}
                      onChange={(value) => {
                        field.onChange(Number.parseInt(value));
                      }}
                      placeholder={
                        isLoadingDirectionGeneral
                          ? "Cargando Direcciones Generales"
                          : "Seleccione una D / O / G"
                      }
                      searchPlaceholder="Buscar dirección..."
                      disabled={isLoadingDirectionGeneral}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <InputForm
              form={form}
              label="Codigo"
              nameInput="Codigo"
              type="number"
              placeholder="Ej. 00000000000"
            />
            <InputForm
              form={form}
              label="Nuevo nombre de la Dirección / Gerencia / Oficina"
              nameInput="direccion_general"
              type="text"
              placeholder="Ej. Dirección ....."
            />
            <Button className="w-full"> Actualizar</Button>
          </form>
        </Form>
      )}
    </>
  );
}
