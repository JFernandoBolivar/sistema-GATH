"use client";
import { Role } from "@/app/types/types";
import InputForm from "@/components/input-form";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import updateRoleAction from "../actions/update-role-action";
import { schemaRole, TypeSchemaRole } from "../registrar/schema/schemaRole";

export default function EditRole({
  role,
  onFinish,
}: {
  role: Role;
  onFinish: () => void;
}) {
  const { mutate } = useSWRConfig();
  const [isPending, startTransition] = useTransition();
  const form = useForm<TypeSchemaRole>({
    defaultValues: {
      nombre_rol: role.nombre_rol,
    },
    resolver: zodResolver(schemaRole),
  });
  const onSubmit = (values: TypeSchemaRole) => {
    startTransition(async () => {
      const response = await updateRoleAction(role.id, values);
      if (response.success) {
        toast.success(response.message);
        mutate("role");
        onFinish();
      } else {
        toast.error(response.message);
      }
    });
  };
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="gap-5">
        <InputForm
          form={form}
          label="Nombre Del Rol"
          nameInput="nombre_rol"
          type="text"
        />
        <Button className="w-full mt-4" disabled={isPending}>
          {isPending ? "Actualizando..." : "Actualizar Rol"}
        </Button>
      </form>
    </Form>
  );
}
