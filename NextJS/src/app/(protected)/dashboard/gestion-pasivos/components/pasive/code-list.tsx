"use client";

import {
  getNominaGeneral,
  getNominaPasivo,
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
import Loading from "../../../gestion-trabajadores/components/loading/loading";
import { getCodeListPasiveSearch } from "../../api/getInfoPasive";
import TableCode from "../../cargos/listado-codigo/tableCodeInfo/page";
import { useSearchStore } from "@/hooks/use-search-params";

export function CodeListPage() {
  const [searchParams, setSearchParams] = useState<string>();
  const schemaSearch = z.object({
    tipo_nomina: z.coerce.number().optional(),
    codigo: z.string().optional(),
  });
  const form = useForm({
    defaultValues: {
      codigo: "",
      tipo_nomina: undefined,
    },
    resolver: zodResolver(schemaSearch),
  });
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nominaPasivo",
    async () => await getNominaPasivo(),
  );
  const onSearch = (values: z.infer<typeof schemaSearch>) => {
    const filteredEntries = Object.entries(values).filter(
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
    ["api/cargos/pasivo", searchParams],
    async () => await getCodeListPasiveSearch({ searchParams }),
  );

  const cleanFields = () => {
    form.reset({
      codigo: "",
      tipo_nomina: undefined,
    });
  };
  return (
    <Card className="bg-background shadow-none border-none  ">
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
