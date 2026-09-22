"use client";

import InputForm from "@/components/input-form";
import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleEllipsis, Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import Loading from "@/shared/ui/components/loading";
import type { DepartamentoDTO, RolDTO, UsuarioDTO } from "@/modules/identidad/application/dtos/usuario-dto";
import {
  getDepartamentosAction,
  getRolesAction,
  listarUsuariosAction,
} from "@/modules/identidad/infrastructure/actions/usuario-actions";
import TableUser from "@/modules/identidad/ui/components/table-user";

const schemaSearch = z.object({
  cedulaidentidad: z.string(),
});

type TypeSchemaSearch = z.infer<typeof schemaSearch>;

export default function UsersModificarPage() {
  const [users, setUsers] = useState<UsuarioDTO[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoDTO[]>([]);
  const [roles, setRoles] = useState<RolDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, startTransition] = useTransition();

  const form = useForm<TypeSchemaSearch>({
    defaultValues: {
      cedulaidentidad: "",
    },
    resolver: zodResolver(schemaSearch),
  });

  const loadData = async (busqueda?: string) => {
    setIsLoading(true);
    try {
      const [u, d, r] = await Promise.all([
        listarUsuariosAction({ busqueda: busqueda || undefined }),
        getDepartamentosAction(),
        getRolesAction(),
      ]);
      setUsers(u);
      setDepartamentos(d);
      setRoles(r);
    } catch {
      toast.error("Error al cargar la información de usuarios");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onSearch = (values: TypeSchemaSearch) => {
    startTransition(async () => {
      await loadData(values.cedulaidentidad.trim());
    });
  };

  const onClean = () => {
    form.reset({
      cedulaidentidad: "",
    });
    startTransition(async () => {
      await loadData();
    });
  };

  return (
    <PageLayout title="Usuarios">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSearch)}
          className="flex gap-2 align-baseline items-center mb-4"
        >
          <InputForm
            form={form}
            label="Cedula"
            nameInput="cedulaidentidad"
            type="text"
          />
          <Button className="self-baseline-last" type="submit" disabled={isSearching}>
            <Search />
            Buscar
          </Button>
          <Button
            onClick={onClean}
            className="self-baseline-last"
            type="button"
            variant={"outline"}
            disabled={isSearching}
          >
            <CircleEllipsis />
            Limpiar
          </Button>
        </form>
      </Form>
      {isLoading ? (
        <Loading />
      ) : (
        <TableUser
          users={users}
          departamentos={departamentos}
          roles={roles}
          onRefresh={() => loadData(form.getValues("cedulaidentidad").trim())}
        />
      )}
    </PageLayout>
  );
}
