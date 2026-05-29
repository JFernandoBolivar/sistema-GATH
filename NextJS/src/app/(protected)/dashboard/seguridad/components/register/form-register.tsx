"use client";
import { Card, CardAction, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import {
  TypeSchemaRegister,
  schemaRegister,
} from "../../gestionar-usuarios/registrar/schema/schemaRegister";
import { zodResolver } from "@hookform/resolvers/zod";
import InputForm from "@/components/input-form";
import useSWR from "swr";
import { getDeparment, getRole } from "../../api/getInfo";
import { SelectForm } from "@/components/select-form";
import { Button } from "@/components/ui/button";
import { useTransition } from "react";
import registerAction from "../../gestionar-usuarios/registrar/action/register-action";
import { toast } from "sonner";

export default function RegisterForm() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<TypeSchemaRegister>({
    defaultValues: {
      cedula: "",
      departamento: 0,
      password: "",
      rol: 0,
    },
    resolver: zodResolver(schemaRegister),
  });
  const { data: role, isLoading: isLoadingRole } = useSWR(
    "role",
    async () => await getRole(),
  );
  const { data: department, isLoading: isLoadingDepartment } = useSWR(
    "depart",
    async () => await getDeparment(),
  );
  const onSubmit = (values: TypeSchemaRegister) => {
    startTransition(async () => {
      const response = await registerAction(values);
      if (response.success) {
        toast.success(response.message);
      } else {
        toast.error(response.message);
      }
      form.reset();
    });
  };
  return (
    <Card>
      <CardContent>
        <CardAction>Registrar Como Usuario A Un Trabajador</CardAction>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                isLoading={isLoadingRole}
                options={role?.data ?? []}
                nameSalect="rol"
                placeholder="Seleccione un rol"
                valueKey="id"
                labelKey="nombre_rol"
              />
              <SelectForm
                Formlabel="Departamentos"
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
            <Button className="w-full">Registrar Usuario</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
