"use client";

import { Card, CardAction, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import InputForm from "@/components/input-form";
import { SelectForm } from "@/components/select-form";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { DepartamentoDTO, RolDTO } from "../../application/dtos/usuario-dto";
import {
  getDepartamentosAction,
  getRolesAction,
  registrarUsuarioAction,
} from "../../infrastructure/actions/usuario-actions";

const schemaRegister = z.object({
  cedula: z
    .string({
      required_error: "Este Campo Es Obligatorio",
    })
    .min(5, {
      message: "Mínimo 5 Caracteres",
    })
    .max(8, {
      message: "Máximo 8 Caracteres",
    }),
  password: z
    .string({
      required_error: "Este Campo Es Obligatorio",
    })
    .min(8, {
      message: "Mínimo 8 Caracteres",
    })
    .max(30, {
      message: "Máximo 30 Caracteres",
    }),
  departamentoId: z.coerce.number().min(1, {
    message: "Debe Seleccionar Un Departamento",
  }),
  rolId: z.coerce.number().min(1, {
    message: "Debe Seleccionar Un Rol",
  }),
});

type TypeSchemaRegister = z.infer<typeof schemaRegister>;

export default function FormRegisterUser() {
  const [isPending, startTransition] = useTransition();
  const [roles, setRoles] = useState<RolDTO[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoDTO[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingDepartamentos, setIsLoadingDepartamentos] = useState(true);

  const form = useForm<TypeSchemaRegister>({
    defaultValues: {
      cedula: "",
      departamentoId: 0,
      password: "",
      rolId: 0,
    },
    resolver: zodResolver(schemaRegister),
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

  const onSubmit = (values: TypeSchemaRegister) => {
    startTransition(async () => {
      try {
        const response = await registrarUsuarioAction({
          cedula: values.cedula,
          password: values.password,
          departamentoId: Number(values.departamentoId),
          rolId: Number(values.rolId),
        });

        if (response && typeof response === "object" && "error" in response) {
          toast.error(response.error as string);
        } else {
          toast.success("Usuario registrado exitosamente");
          form.reset({
            cedula: "",
            password: "",
            departamentoId: 0,
            rolId: 0,
          });
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al registrar el usuario");
      }
    });
  };

  return (
    <Card>
      <CardContent>
        <CardAction>Registrar Como Usuario A Un Trabajador</CardAction>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="gap-5">
            <div className="grid grid-cols-2 gap-2">
              <InputForm
                form={form}
                label="Cedula"
                nameInput="cedula"
                type="number"
              />
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
            <Button className="w-full mt-4" disabled={isPending}>
              {isPending ? "Registrando..." : "Registrar Usuario"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
