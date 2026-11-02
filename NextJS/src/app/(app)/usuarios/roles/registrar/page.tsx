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
import { z } from "zod";

import { crearRolAction } from "@/modules/identidad/infrastructure/actions/usuario-actions";

const schemaRole = z.object({
  nombre_rol: z
    .string()
    .min(1, { message: "El nombre del rol es obligatorio" })
    .max(50, { message: "Máximo 50 caracteres" }),
});

type TypeSchemaRole = z.infer<typeof schemaRole>;

export default function RegisterRolePage() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<TypeSchemaRole>({
    defaultValues: {
      nombre_rol: "",
    },
    resolver: zodResolver(schemaRole),
  });

  const onSubmit = (values: TypeSchemaRole) => {
    startTransition(async () => {
      try {
        const response = await crearRolAction({
          nombreRol: values.nombre_rol.toUpperCase(),
        });

        if (response && typeof response === "object" && "error" in response) {
          toast.error(response.error as string);
        } else {
          toast.success("Rol creado exitosamente");
          form.reset();
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al registrar el rol");
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
