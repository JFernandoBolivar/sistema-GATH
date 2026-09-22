"use client";

/**
 * Formulario de login del módulo auth (paso 13 del checklist §II.8). Cliente +
 * react-hook-form + zodResolver; la mutación va envuelta en useTransition (R8).
 * Los componentes provienen del barrel nuevo `@/shared/ui/components` (F2.13).
 * Layout/textos calcados del legado (src/components/login-form.tsx del repo de
 * referencia) para paridad visual exacta -- solo cambia la arquitectura interna
 * (Onion), no el diseño.
 */
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/shared/ui/components/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/form";
import { Input } from "@/shared/ui/components/input";
import { loginFormSchema, type LoginFormType } from "./schema/schema-login";
import { loginAction } from "../infrastructure/actions/auth-actions";

export default function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormType>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { usuario: "", password: "" },
  });

  function onSubmit(values: LoginFormType) {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(values);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // Navegacion dura (no router.push): el Router Cache de Next.js puede
      // reutilizar una entrada prefetcheada antes del login (con session=null).
      // Un location.href fuerza una carga completa que re-ejecuta el
      // RootLayout con la sesion ya autenticada en /dashboard.
      window.location.href = "/dashboard";
    });
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">
            Inicia Sesión Con Tus Credenciales
          </h1>
        </div>
        <div className="grid gap-6">
          <div className="grid gap-3">
            <FormField
              control={form.control}
              name="usuario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico:</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="correo@conatel.gob.ve"
                      {...field}
                      className="transition-property: all transition-duration: 300ms placeholder:text-white hover:bg-slate-900/20"
                    />
                  </FormControl>
                  <FormDescription className="text-white">
                    Introduce tu correo electrónico institucional.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-3">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña:</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Tu Contraseña"
                      className="hover:bg-slate-900/20 placeholder:text-white"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-white">
                    Coloque su contraseña de acceso.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {error && <FormMessage>{error}</FormMessage>}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Iniciando sesión..." : "Iniciar Sesión"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
