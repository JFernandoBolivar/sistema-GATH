"use client";

import InputForm from "@/components/input-form";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";

import type { RolDTO } from "../../application/dtos/usuario-dto";
import { actualizarRolAction } from "../../infrastructure/actions/usuario-actions";

const schemaRole = z.object({
  nombre_visible: z
    .string()
    .trim()
    .min(2, { message: "El nombre del rol debe tener al menos 2 caracteres" })
    .max(100, { message: "Máximo 100 caracteres" }),
});

type TypeSchemaRole = z.infer<typeof schemaRole>;

export default function EditRole({
  role,
  onFinish,
}: {
  role: RolDTO;
  onFinish: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<TypeSchemaRole>({
    defaultValues: {
      nombre_visible: role.nombreVisible,
    },
    resolver: zodResolver(schemaRole),
  });

  const onSubmit = (values: TypeSchemaRole) => {
    startTransition(async () => {
      try {
        const response = await actualizarRolAction(role.id, {
          nombreVisible: values.nombre_visible,
        });

        if (response && typeof response === "object" && "error" in response) {
          const fallo = response as { error: string; errores?: Record<string, string[]> };
          const sinUbicar = aplicarErroresServidor(form, fallo.errores, {
            nombre: "nombre_visible",
            nombre_visible: "nombre_visible",
            nombre_rol: "nombre_visible",
          });
          if (sinUbicar.length > 0 || !fallo.errores) toast.error(fallo.error);
        } else {
          toast.success("Rol actualizado exitosamente");
          onFinish();
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar el rol");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="gap-5">
        <InputForm
          form={form}
          label="Nombre Del Rol"
          nameInput="nombre_visible"
          type="text"
        />
        <Button className="w-full mt-4" disabled={isPending}>
          {isPending ? "Actualizando..." : "Actualizar Rol"}
        </Button>
      </form>
    </Form>
  );
}
