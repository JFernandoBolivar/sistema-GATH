"use client";

/**
 * Página de alta de usuarios en ruta propia — paridad con el legado
 * (`seguridad/gestionar-usuarios/registrar/page.tsx`), que tenía el alta en
 * una ruta separada del listado en vez de un formulario siempre visible
 * arriba de la tabla.
 */
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Field } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

import type { DepartamentoDTO, RolDTO } from "../application/dtos/usuario-dto";
import {
  getDepartamentosAction,
  getRolesAction,
  registrarUsuarioAction,
} from "../infrastructure/actions/usuario-actions";
import { registrarUsuarioSchema, type RegistrarUsuarioFormType } from "./schema/schema-usuario";

export default function UsuarioRegistrarPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const puedeCrear = tienePermiso(session?.user?.permisos, "identidad.crear_usuarios");
  const [isPending, startTransition] = useTransition();
  const [departamentos, setDepartamentos] = useState<DepartamentoDTO[]>([]);
  const [roles, setRoles] = useState<RolDTO[]>([]);

  const form = useForm<RegistrarUsuarioFormType>({
    resolver: zodResolver(registrarUsuarioSchema),
    defaultValues: { cedula: "", password: "", departamentoId: null, rolId: null },
  });

  useEffect(() => {
    Promise.all([getDepartamentosAction(), getRolesAction()])
      .then(([d, r]) => {
        setDepartamentos(d);
        setRoles(r);
      })
      .catch(() => toast.error("No fue posible cargar los catálogos de departamento y rol."));
  }, []);

  const onSubmit = (data: RegistrarUsuarioFormType) => {
    if (!puedeCrear) {
      toast.error("No tiene permisos para registrar usuarios.");
      return;
    }
    startTransition(async () => {
      const resultado = await registrarUsuarioAction(data);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        toast.error((resultado as { error: string }).error);
        return;
      }
      toast.success("Usuario registrado correctamente.");
      router.push("/usuarios");
    });
  };

  return (
    <section className="flex flex-col gap-4 px-6 py-4">
      <header className="flex items-center gap-2">
        <UserPlus className="size-5 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-xl font-semibold tracking-tight">Registrar usuario</h1>
      </header>

      {!puedeCrear && (
        <div role="alert" className="max-w-2xl rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive font-medium">
          No tiene permisos suficientes para registrar usuarios (se requiere identidad.crear_usuarios).
        </div>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Registrar como usuario a un trabajador</CardTitle>
          <CardDescription>Cree una cuenta de acceso al sistema para un trabajador existente.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field data-invalid={!!form.formState.errors.cedula}>
                <Label htmlFor="cedula">Cédula</Label>
                <Input
                  id="cedula"
                  placeholder="Ej. 12345678"
                  {...form.register("cedula")}
                  aria-invalid={!!form.formState.errors.cedula}
                />
                {form.formState.errors.cedula && (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.cedula.message}
                  </p>
                )}
              </Field>
              <Field data-invalid={!!form.formState.errors.password}>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  type="password"
                  id="password"
                  placeholder="Mínimo 8 caracteres"
                  {...form.register("password")}
                  aria-invalid={!!form.formState.errors.password}
                />
                {form.formState.errors.password && (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </Field>
              <Field>
                <Label htmlFor="rol">Rol</Label>
                <Select
                  value={form.watch("rolId") ? String(form.watch("rolId")) : undefined}
                  onValueChange={(v) => form.setValue("rolId", Number(v))}
                >
                  <SelectTrigger id="rol" className="w-full">
                    <SelectValue placeholder="Seleccione un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.nombreRol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <Label htmlFor="departamento">Departamento</Label>
                <Select
                  value={form.watch("departamentoId") ? String(form.watch("departamentoId")) : undefined}
                  onValueChange={(v) => form.setValue("departamentoId", Number(v))}
                >
                  <SelectTrigger id="departamento" className="w-full">
                    <SelectValue placeholder="Seleccione un departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentos.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Button type="submit" size="lg" disabled={isPending || !puedeCrear} className="w-full">
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="size-4" aria-hidden="true" />
              )}
              {isPending ? "Registrando..." : "Registrar usuario"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
