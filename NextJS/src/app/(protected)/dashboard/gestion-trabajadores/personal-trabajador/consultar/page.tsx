"use client";
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
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import z from "zod";
import PageLayout from "../../../../../../components/layout/page-layout";
import { getEmployeeDataSearch, getNomina } from "../../api/getInfoRac";
import TableEmployee from "../../components/employees/tableEmployees/page";
import Loading from "../../components/loading/loading";
import { useSearchStore } from "@/hooks/use-search-params";

export default function PersonalPage() {
  const { data: session } = useSession();
  const [searchParams, setSearchParams] = useState<string>();
  const schemaSearch = z.object({
    cedulaidentidad: z.string().optional(),
    tipo_nomina: z.coerce.number().optional(),
    codigo: z.string().optional(),
  });
  const form = useForm({
    defaultValues: {
      cedulaidentidad: "",
      tipo_nomina: undefined,
      codigo: "",
    },
    resolver: zodResolver(schemaSearch),
  });
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nomina",
    async () => await getNomina(),
  );
  const onSearch = (values: z.infer<typeof schemaSearch>) => {
    const isNotAdmin = session?.user?.role.nombre_rol !== "ADMINISTRADOR";
    const payload = {
      ...values,
      dependencia_id: isNotAdmin ? Number(session?.user.dependency?.id) : "",
      direccion_general_id: isNotAdmin
        ? Number(session?.user.directionGeneral?.id)
        : "",
      direccion_linea_id: isNotAdmin
        ? Number(session?.user.direccionLine?.id) || null
        : "",
      coordinacion_id: isNotAdmin
        ? Number(session?.user.coordination?.id) || null
        : "",
    };
    const filteredEntries = Object.entries(payload).filter(
      ([_, v]) => v !== "" && v !== 0 && v !== undefined && v !== null,
    );
    const params = new URLSearchParams(filteredEntries as unknown as string);
    setSearchParams(params.toString());
  };
  const setSearchGlobal = useSearchStore((state) => state.setSearchParams);
  setSearchGlobal(searchParams || "");
  const { data: employeeData, isLoading } = useSWR(
    ["api/empleados", searchParams],
    () => getEmployeeDataSearch({ searchParams }),
  );
  const cleanFields = () => {
    form.reset({
      cedulaidentidad: "",
      codigo: "",
      tipo_nomina: 0,
    });
  };
  return (
    <PageLayout
      title="Consultar Trabajador"
      description="Información Detallada Del Trabajador"
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSearch)}
          className="flex flex-col justify-start gap-2 flex-1"
        >
          <div className="flex flex-row items-center gap-2 ">
            <FormField
              name="cedulaidentidad"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buscar Cédula</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="buscar cedula..."
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              name="codigo"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buscar Código De Trabajador</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="buscar codigo de trabajador..."
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
                          placeholder={`${isLoadingNomina ? "Cargando Nominas" : "Seleccione un Tipo de Nomina"}`}
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
            />
            <Button className="cursor-pointer self-baseline-last">
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
        </form>
      </Form>
      {isLoading ? (
        <Loading promiseMessage="Cargando Información"></Loading>
      ) : (
        <>
          <TableEmployee employeeData={employeeData?.data ?? []} />
        </>
      )}
    </PageLayout>
  );
}
