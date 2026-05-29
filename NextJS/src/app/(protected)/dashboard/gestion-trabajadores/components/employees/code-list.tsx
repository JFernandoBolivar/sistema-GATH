"use client";

import {
  getCodeListSearch,
  getCoordination,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getNominaGeneral,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eraser, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../../../components/ui/card";
import TableCode from "../../cargos/listado-codigo/tableCodeInfo/page";
import Loading from "../loading/loading";
import { useSearchStore } from "@/hooks/use-search-params";

export function CodeListPage() {
  const { data: session } = useSession();
  const [searchParams, setSearchParams] = useState<string>();
  const schemaSearch = z.object({
    tipo_nomina: z.coerce.number().optional(),
    codigo: z.string().optional(),
    dependencia_id: z.coerce.number().optional(),
    direccion_general_id: z.coerce.number().optional(),
    direccion_linea_id: z.coerce.number().optional(),
    coordinacion_id: z.coerce.number().optional(),
  });
  const [dependencyId, setDependencyId] = useState<number>(0);

  const [directionGeneralId, setDirectionGeneralId] = useState<string | null>(
    null,
  );
  const [directionLineId, setDirectionLineId] = useState<string | null>(null);

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
    directionGeneralId ? ["directionLine", directionGeneralId] : null,
    async () => await getDirectionLine(directionGeneralId!),
  );
  const { data: coordination, isLoading: isLoadingCoordination } = useSWR(
    directionLineId ? ["coordination", directionLineId] : null,
    async () => await getCoordination(directionLineId!),
  );
  const form = useForm({
    defaultValues: {
      codigo: "",
      tipo_nomina: undefined,
      dependencia_id: undefined,
      direccion_general_id: undefined,
      direccion_linea_id: undefined,
      coordinacion_id: undefined,
    },
    resolver: zodResolver(schemaSearch),
  });
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nominaGeneral",
    async () => await getNominaGeneral(),
  );
  const onSearch = (values: z.infer<typeof schemaSearch>) => {
    const isNotAdmin = session?.user?.role.nombre_rol !== "ADMINISTRADOR";
    const payload = {
      ...values,
      dependencia_id: isNotAdmin
        ? Number(session?.user.dependency?.id)
        : values.dependencia_id,
      direccion_general_id: isNotAdmin
        ? Number(session?.user.directionGeneral?.id)
        : (values.direccion_general_id ?? ""),
      direccion_linea_id: isNotAdmin
        ? Number(session?.user.direccionLine?.id) || null
        : (values.direccion_linea_id ?? ""),
      coordinacion_id: isNotAdmin
        ? Number(session?.user.coordination?.id) || null
        : (values.coordinacion_id ?? ""),
    };
    const filteredEntries = Object.entries(payload).filter(
      ([_, v]) => v !== "" && v !== undefined && v !== null,
    );
    const params = new URLSearchParams(filteredEntries as unknown as string);
    setSearchParams(params.toString());
  };
  const setSearchParamsGlobal = useSearchStore(
    (state) => state.setSearchParams,
  );
  setSearchParamsGlobal(searchParams || "");
  const { data: codeList, isLoading } = useSWR(
    ["api/cargos", searchParams],
    async () => await getCodeListSearch({ searchParams }),
  );

  const cleanFields = () => {
    form.reset({
      codigo: "",
      tipo_nomina: undefined,
      dependencia_id: undefined,
      direccion_general_id: undefined,
      direccion_linea_id: undefined,
      coordinacion_id: undefined,
    });
  };
  return (
    <Card className=" bg-background shadow-none border-none ">
      <CardHeader>
        <CardTitle>
          <h1>Listado De Cargos</h1>
        </CardTitle>
        <CardDescription>
          Listado Detallado De Cargos Registrados En El Sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSearch)}>
            <div className="flex flex-row items-center gap-2 w-full flex-1">
              <div className="grid grid-cols-2 gap-2 w-full min-w-0">
                <FormField
                  name="codigo"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buscar Código </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="buscar codigo..."
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tipo_nomina"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Nomina</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={`${
                                isLoadingNomina
                                  ? "Cargando Nominas"
                                  : "Seleccione un Tipo de Nomina"
                              }`}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Ninguno</SelectItem>
                          {nomina?.data.map((nomina, i) => (
                            <SelectItem key={i} value={`${nomina.id}`}>
                              {nomina.nomina}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />{" "}
                <FormField
                  control={form.control}
                  name="dependencia_id"
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
                                  : "Seleccione un Nivel"
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
                  name="direccion_general_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                          setDirectionGeneralId(values);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={`${
                                isLoadingDirectionGeneral
                                  ? "Cargando Direcciones"
                                  : "Seleccione una Dirección"
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
                  name="direccion_linea_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>División / Coordinación </FormLabel>

                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                          setDirectionLineId(values);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={`${
                                isLoadingDirectionLine
                                  ? "Cargando División / Coordinación"
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
                <FormField
                  control={form.control}
                  name="coordinacion_id"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Coordinación</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={`${
                                isLoadingCoordination
                                  ? "Cargando Coordinaciones"
                                  : "Seleccione una Coordinación"
                              }`}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {coordination?.data.map((coord, i) => (
                            <SelectItem key={i} value={`${coord.id}`}>
                              {coord.Codigo}-{coord.coordinacion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  className="cursor-pointer self-baseline-last"
                  type="submit"
                >
                  Buscar <Search />
                </Button>
                <Button
                  variant={"outline"}
                  className="cursor-pointer self-baseline-last"
                  type="button"
                  onClick={cleanFields}
                >
                  Limpiar <Eraser />
                </Button>
              </div>
            </div>
          </form>
        </Form>
        {isLoading && <Loading />}
        {!isLoading && (
          <div className="w-full overflow-x-auto">
            <TableCode codeList={codeList?.data ?? []} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
