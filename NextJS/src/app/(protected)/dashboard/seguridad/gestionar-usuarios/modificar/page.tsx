"use client";
import InputForm from "@/components/input-form";
import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleEllipsis, Search } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import z from "zod";
import Loading from "../../../gestion-trabajadores/components/loading/loading";
import { getDeparment, getRole, getUserListSearch } from "../../api/getInfo";
import TableUser from "./tableUser/page";
import { useSearchStore } from "@/hooks/use-search-params";

export default function UsersPage() {
  const [searchParams, setSearchParams] = useState<string>();
  const setSearchGlobal = useSearchStore((state) => state.setSearchParams);
  setSearchGlobal(searchParams || "");
  const { data: user, isLoading: isLoadingUser } = useSWR(
    ["/api/users", searchParams],
    async () => await getUserListSearch({ searchParams }),
  );
  const { data: role } = useSWR("role", async () => await getRole());
  const { data: department } = useSWR("depart", async () => await getDeparment());
  const schemaSearch = z.object({
    cedula: z.string(),
  });
  const onSearch = (values: z.infer<typeof schemaSearch>) => {
    const filteredEntries = Object.entries(values).filter(
      ([_, v]) => v !== "" && v !== undefined && v !== null,
    );
    const params = new URLSearchParams(filteredEntries as unknown as string);
    setSearchParams(params.toString());
  };
  const form = useForm<z.infer<typeof schemaSearch>>({
    defaultValues: {
      cedula: "",
    },
    resolver: zodResolver(schemaSearch),
  });
  const onClean = () => {
    form.reset({
      cedula: "",
    });
  };
  return (
    <PageLayout title="Usuarios">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSearch)}
          className="flex gap-2 align-baseline items-center"
        >
          <InputForm
            form={form}
            label="Cedula"
            nameInput="cedula"
            type="text"
          />
          <Button className="self-baseline-last" type="submit">
            <Search />
            Buscar
          </Button>
          <Button
            onClick={onClean}
            className="self-baseline-last"
            type="button"
            variant={"outline"}
          >
            <CircleEllipsis />
            Limpiar
          </Button>
        </form>
      </Form>
      {isLoadingUser ? (
        <Loading />
      ) : (
        <TableUser
          user={user?.data ?? []}
          roles={role?.data ?? []}
          departamentos={department?.data ?? []}
        />
      )}
    </PageLayout>
  );
}
