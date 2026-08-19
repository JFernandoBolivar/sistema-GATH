"use client";
import InputForm from "@/components/input-form";
import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import createRoleAction from "./action/create-role-action";
import { schemaRole, TypeSchemaRole } from "./schema/schemaRole";

export default function RegisterRolePage() {
  const { mutate } = useSWRConfig();
  const [isPending, startTransition] = useTransition();
  const form = useForm<TypeSchemaRole>({
    defaultValues: {
      nombre_rol: "",
    },
    resolver: zodResolver(schemaRole),
  });
  const onSubmit = (values: TypeSchemaRole) => {
    startTransition(async () => {
      const response = await createRoleAction(values);
      if (response.success) {
        toast.success(response.message);
        // "role" es la clave que comparten los selectores de rol del modulo
        mutate("role");
        form.reset();
      } else {
        toast.error(response.message);
      }
    });
  };
  return (
    <PageLayout title="Registrar Roles">
      <Card>
        <CardContent>
          <CardAction>Registrar Un Nuevo Rol En El Sistema</CardAction>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="gap-5">
              <div className="grid grid-cols-1 gap-2">
                <InputForm
                  form={form}
                  label="Nombre Del Rol"
                  nameInput="nombre_rol"
                  placeholder="Ejemplo: RECEPCIONISTA"
                  description="El nombre se guarda en mayusculas y no puede repetirse."
                  type="text"
                />
              </div>
              <Button className="w-full mt-4" disabled={isPending}>
                {isPending ? "Registrando..." : "Registrar Rol"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
