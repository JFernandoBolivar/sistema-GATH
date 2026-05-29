"use client";
import Loading from "@/app/(protected)/dashboard/gestion-trabajadores/components/loading/loading";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eraser, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import z from "zod";
import PageLayout from "../../../../../../../components/layout/page-layout";
import TableFamily from "../../../components/pasive/tableFamilys/table";
import { getFamilyPasive } from "../../../api/getInfoPasive";
import { useSearchStore } from "@/hooks/use-search-params";
export default function FamilyConsultPasive() {
  const [searchParams, setSearchParams] = useState<string>();

  const { data: session } = useSession();
  const schemaSearch = z.object({
    cedula_empleado: z.string(),
  });
  const form = useForm({
    defaultValues: {
      cedula_empleado: "",
    },
    resolver: zodResolver(schemaSearch),
  });
  const setSearchParamsGlobal = useSearchStore(
    (state) => state.setSearchParams,
  );
  setSearchParamsGlobal(searchParams || "");
  const { data: family, isLoading } = useSWR(
    ["familyPasive", searchParams],
    () => getFamilyPasive({ searchParams }),
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
      ([_, v]) =>
        v !== "" &&
        v !== 0 &&
        v !== undefined &&
        v !== null &&
        !Number.isNaN(v),
    );
    const params = new URLSearchParams(filteredEntries as unknown as string);
    setSearchParams(params.toString());
  };

  const cleanFields = () => {
    form.reset({
      cedula_empleado: "",
    });
  };
  return (
    <PageLayout
      description="Consulte El Familiar Del Personal Pasivo/Jubilado"
      title="Consultar Familiar"
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSearch)}
          className="flex flex-col justify-start gap-2 flex-1"
        >
          <div className="flex flex-row items-center gap-2 ">
            <FormField
              name="cedula_empleado"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Buscar Cédula del Personal Pasivo/Jubilado
                  </FormLabel>
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
          <TableFamily familys={family?.data ?? []} />
        </>
      )}
    </PageLayout>
  );
}
