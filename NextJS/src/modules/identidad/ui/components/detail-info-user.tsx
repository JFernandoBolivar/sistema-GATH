"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import InputForm from "@/components/input-form";
import { SelectForm } from "@/components/select-form";
import { Button } from "@/components/ui/button";
import { z } from "zod";

import Loading from "@/shared/ui/components/loading";
import type { DepartamentoDTO, RolDTO } from "../../application/dtos/usuario-dto";
import {
  editarUsuarioAction,
  getDepartamentosAction,
  getRolesAction,
} from "../../infrastructure/actions/usuario-actions";

const schemaUpdateUser = z.object({
  password: z.string().optional(),
  rolId: z.coerce.number().optional(),
  departamentoId: z.coerce.number().optional(),
});

type TypeSchemaUpdateUser = z.infer<typeof schemaUpdateUser>;

export default function DetailInfoUser({
  id,
  onFinish,
}: {
  id: number;
  onFinish?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [roles, setRoles] = useState<RolDTO[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoDTO[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingDepartamentos, setIsLoadingDepartamentos] = useState(true);

  const form = useForm<TypeSchemaUpdateUser>({
    defaultValues: {
      departamentoId: 0,
      password: "",
      rolId: 0,
    },
    resolver: zodResolver(schemaUpdateUser),
  });

  useEffect(() => {
    getRolesAction()
      .then((res) => setRoles(res))
      .catch(() => toast.error("Error al cargar roles"))
      .finally(() => setIsLoadingRoles(false));

    getDepartamentosAction()
      .then((res) => setDepartamentos(res))
      .catch(() => toast.error("Error al cargar departamentos"))
      .finally(() => setIsLoadingDepartamentos(false));
  }, []);

  const onSubmit = (values: TypeSchemaUpdateUser) => {
    startTransition(async () => {
      try {
        const response = await editarUsuarioAction(id, {
          password: values.password && values.password.trim() !== "" ? values.password : null,
          rolId: values.rolId ? Number(values.rolId) : null,
          departamentoId: values.departamentoId ? Number(values.departamentoId) : null,
        });

        if (response && typeof response === "object" && "error" in response) {
          toast.error(response.error as string);
        } else {
          toast.success("Usuario actualizado correctamente");
          form.reset();
          if (onFinish) onFinish();
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar el usuario");
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
                isLoading={isLoadingRoles}
                options={roles}
                nameSalect="rolId"
                placeholder="Seleccione un rol"
                valueKey="id"
                labelKey="nombreRol"
              />
              <SelectForm
                Formlabel="Departamentos"
                classNameItem="col-span-2"
                form={form}
                SelectLabelItem="Departamentos"
                isLoading={isLoadingDepartamentos}
                options={departamentos}
                nameSalect="departamentoId"
                placeholder="Seleccione un departamento"
                valueKey="id"
                labelKey="nombre"
              />
            </div>
            <Button className="w-full mt-4" type="submit">
              Actualizar Usuario
            </Button>
          </form>
        </Form>
      )}
    </>
  );
}
