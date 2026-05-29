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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import {
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
} from "../../api/getInfoRac";
import upgradeDirectionLineCoordAction from "../../ubicacion-administrativa/actualizar-ubicacion/actions/upgradeDirectionLineCoord";
import {
  schemaUpgradeDireccionLineCoord,
  SchemaUpgradeDireccionLineCoord,
} from "../../ubicacion-administrativa/actualizar-ubicacion/schema/schemaUpdateDireccionLineCoord";
import Loading from "../loading/loading";

export default function UpdateDireccionLineCoord() {
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
  const { data: directionLine, isLoading: isLoadingDirectionLine } = useSWR(
    selecteIdDirectionGeneral
      ? ["directionLine", selecteIdDirectionGeneral]
      : "",
    async () => await getDirectionLine(selecteIdDirectionGeneral!),
  );
  const form = useForm<SchemaUpgradeDireccionLineCoord>({
    defaultValues: {
      Codigo: "",
      dependenciaId: 0,
      direccion_linea: "",
      direccionGeneral: 0,
      id: 0,
    },
    resolver: zodResolver(schemaUpgradeDireccionLineCoord),
  });
  const onSubmit = (values: SchemaUpgradeDireccionLineCoord) => {
    startTransition(async () => {
      const response = await upgradeDirectionLineCoordAction(values);
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="dependenciaId"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Nivel</FormLabel>
                  <Select
                    onValueChange={(values) => {
                      field.onChange(Number.parseInt(values));
                      setDependencyId(Number.parseInt(values));
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full truncate">
                        <SelectValue
                          placeholder={`${
                            isLoadingDependency
                              ? "Cargando Nivel"
                              : "Seleccione Nivel"
                          }`}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {dependency?.data.map((dependencia, i) => (
                        <SelectItem key={i} value={`${dependencia.id}`}>
                          {dependencia.dependencia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select
                    onValueChange={(values) => {
                      field.onChange(Number.parseInt(values));
                      setSelecteIdDirectionGeneral(values);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full truncate">
                        <SelectValue
                          placeholder={`${
                            isLoadingDirectionGeneral
                              ? "Cargando Direcciones "
                              : "Seleccione una Dirección "
                          }`}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {directionGeneral?.data.map((general, i) => (
                        <SelectItem key={i} value={`${general.id}`}>
                          {general.Codigo}-{general.direccion_general}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>División / Coordinación</FormLabel>
                  <Select
                    onValueChange={(values) => {
                      field.onChange(Number.parseInt(values));
                      setSelecteIdDirectionLine(values);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full truncate">
                        <SelectValue
                          placeholder={`${
                            isLoadingDirectionLine
                              ? "Cargando División / Coordinación "
                              : "Seleccione una División / Coordinación"
                          }`}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {directionLine?.data.map((line, i) => (
                        <SelectItem key={i} value={`${line.id}`}>
                          {line.Codigo}-{line.direccion_linea}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              label="Nuevo nombre de la División / Coordinación"
              nameInput="direccion_linea"
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
