"use client";

import { useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import useSWR, { useSWRConfig } from "swr";
import { useTransition } from "react";
import { toast } from "sonner";
import InputForm from "@/components/input-form";
import { SelectForm } from "@/components/select-form";
import { Button } from "@/components/ui/button";
import {
  schemaUpdateUser,
  TypeSchemaUpdateUser,
} from "./updateInfo/schema/schemaUpdateUser";
import { getDeparment, getRole } from "../../../api/getInfo";
import updateAction from "../action/update-user-action";
import Loading from "@/app/(protected)/dashboard/gestion-trabajadores/components/loading/loading";
import { useSearchStore } from "@/hooks/use-search-params";

export default function DetailInfoUser({ id }: { id: number }) {
  const { mutate } = useSWRConfig();
  const [isPending, startTransition] = useTransition();
  const form = useForm<TypeSchemaUpdateUser>({
    defaultValues: {
      departamento: 0,
      password: undefined,
      rol: undefined,
    },
    resolver: zodResolver(schemaUpdateUser),
  });
  const { data: role, isLoading: isLoadingRole } = useSWR(
    "role",
    async () => await getRole(),
  );
  const { data: department, isLoading: isLoadingDepartment } = useSWR(
    "depart",
    async () => await getDeparment(),
  );
  const searchParams = useSearchStore((state) => state.searchParams);
  const onSubmit = (values: TypeSchemaUpdateUser) => {
    startTransition(async () => {
      const response = await updateAction(values, id);
      if (response.success) {
        toast.success(response.message);
        mutate(["/api/users", searchParams]);
      } else {
        toast.error(response.message);
      }
      form.reset();
    });
  };
  return (
    <>
      {isPending ? (
        <Loading />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              <InputForm
                form={form}
                label="Contraseña"
                nameInput="password"
                type="text"
              />

              <SelectForm
                Formlabel="Rol"
                form={form}
                SelectLabelItem="Roles"
                isLoading={isLoadingRole}
                options={role?.data ?? []}
                nameSalect="rol"
                placeholder="Seleccione un rol"
                valueKey="id"
                labelKey="nombre_rol"
              />
              <SelectForm
                Formlabel="Departamentos"
                classNameItem="col-span-2"
                form={form}
                SelectLabelItem="Departamentos"
                isLoading={isLoadingDepartment}
                options={department?.data ?? []}
                nameSalect="departamento"
                placeholder="Seleccione un departamento"
                valueKey="id"
                labelKey="nombre_departamento"
              />
            </div>
            <Button className="w-full">Actualizar Usuario</Button>
          </form>
        </Form>
      )}
    </>
  );
}
