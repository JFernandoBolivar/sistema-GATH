"use client";

/**
 * Formulario de login del módulo auth (paso 13 del checklist §II.8). Cliente +
 * react-hook-form + zodResolver; la mutación va envuelta en useTransition (R8).
 * Los componentes provienen del barrel nuevo `@/shared/ui/components` (F2.13).
 * Los iconos usan lucide-react: @phosphor-icons/react NO está instalado en GATH.
 */
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogIn, Lock, User } from "lucide-react";

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
import { loginFormSchema, type LoginFormType } from "./schema/schema-login";
import { loginAction } from "../infrastructure/actions/auth-actions";

export default function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<LoginFormType>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { usuario: "", password: "" },
  });

  const onSubmit = (data: LoginFormType) => {
    startTransition(async () => {
      const result = await loginAction(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success);
      form.reset();
      router.push("/dashboard");
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center pb-4 text-center">
        <CardTitle>Iniciar Sesión</CardTitle>
        <CardDescription>Ingrese sus credenciales institucionales</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
          noValidate
        >
          <Controller
            name="usuario"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Label htmlFor="usuario">Usuario</Label>
                <div className="relative flex items-center">
                  <User
                    className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    {...field}
                    id="usuario"
                    type="email"
                    autoComplete="username"
                    placeholder="Ej. nombre@conatel.gob.ve"
                    aria-invalid={fieldState.invalid}
                    className="pl-9"
                  />
                </div>
                {fieldState.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </Field>
            )}
          />

          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative flex items-center">
                  <Lock
                    className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    {...field}
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={fieldState.invalid}
                    className="pl-9"
                  />
                </div>
                {fieldState.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {fieldState.error.message}
                  </p>
                )}
              </Field>
            )}
          />

          <Button type="submit" size="lg" disabled={isPending} className="mt-2 w-full">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="size-4" aria-hidden="true" />
            )}
            {isPending ? "Ingresando..." : "Ingresar al Sistema"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
