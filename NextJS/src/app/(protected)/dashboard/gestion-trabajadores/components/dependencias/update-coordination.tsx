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

import Loading from "../loading/loading";
import {
  schemaUpgradeCoordination,
  SchemaUpgradeCoordination,
} from "../../ubicacion-administrativa/actualizar-ubicacion/schema/schemaUpdateCoordination";
import upgradeCoordinationActions from "../../ubicacion-administrativa/actualizar-ubicacion/actions/upgradeCoordination";

export default function UpdateCoord() {
  const [selecteIdDirectionLine, setSelecteIdDirectionLine] =
    useState<string>();
  const [selecteIdDirectionGeneral, setSelecteIdDirectionGeneral] =
    useState<string>();
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
  const { data: coordination, isLoading: isLoadingCoordination } = useSWR(
    selecteIdDirectionLine ? ["coordination", selecteIdDirectionLine] : null,
    async () => await getCoordination(selecteIdDirectionLine!),
  );
  const { data: directionLine, isLoading: isLoadingDirectionLine } = useSWR(
    selecteIdDirectionGeneral
      ? ["directionLine", selecteIdDirectionGeneral]
      : "",
    async () => await getDirectionLine(selecteIdDirectionGeneral!),
  );
  const form = useForm<SchemaUpgradeCoordination>({
    defaultValues: {
      Codigo: "",
      dependenciaId: 0,
      direccionGeneral: 0,
      coordinacion: "",
      direccionLinea: 0,
      id: 0,
    },
    resolver: zodResolver(schemaUpgradeCoordination),
  });
  const onSubmit = (values: SchemaUpgradeCoordination) => {
    startTransition(async () => {
      const response = await upgradeCoordinationActions(values);
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
              name="direccionGeneral"
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
                        setSelecteIdDirectionGeneral(value);
                      }}
                      placeholder={
                        isLoadingDirectionGeneral
                          ? "Cargando D / O / G"
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
            <FormField
              control={form.control}
              name="direccionLinea"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>División / Coordinación</FormLabel>
                  <FormControl>
                    <Combobox
                      options={(directionLine?.data ?? []).map((line) => ({
                        value: `${line.id}`,
                        label: `${line.Codigo}-${line.direccion_linea}`,
                      }))}
                      value={field.value ? `${field.value}` : ""}
                      onChange={(value) => {
                        field.onChange(Number.parseInt(value));
                        setSelecteIdDirectionLine(value);
                      }}
                      placeholder={
                        isLoadingDirectionLine
                          ? "Cargando División / Coordinación "
                          : "Seleccione una División / Coordinación"
                      }
                      searchPlaceholder="Buscar división o coordinación..."
                      disabled={isLoadingDirectionLine}
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
                <FormItem className="col-span-2">
                  <FormLabel>Coordinación</FormLabel>
                  <FormControl>
                    <Combobox
                      options={(coordination?.data ?? []).map((coord) => ({
                        value: `${coord.id}`,
                        label: `${coord.Codigo}-${coord.coordinacion}`,
                      }))}
                      value={field.value ? `${field.value}` : ""}
                      onChange={(value) => {
                        field.onChange(Number.parseInt(value));
                      }}
                      placeholder={
                        isLoadingCoordination
                          ? "Cargando Coordinaciones"
                          : "Seleccione una Coordinación"
                      }
                      searchPlaceholder="Buscar coordinación..."
                      disabled={isLoadingCoordination}
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
              label="Nuevo nombre de la coordinación"
              nameInput="coordinacion"
              type="text"
              placeholder="Ej. D / O / G....."
            />
            <Button className="w-full"> Actualizar</Button>
          </form>
        </Form>
      )}
    </>
  );
}
