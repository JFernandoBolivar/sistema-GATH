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
import Link from "next/link";
import { Eye, EyeOff, KeyRound } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Form,
  FormControl,
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
  const [showPassword, setShowPassword] = useState(false);

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
      // RootLayout con la sesion ya autenticada en /inicio.
      window.location.href = "/inicio";
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
                  <FormLabel className="text-white font-medium">Correo Electrónico:</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="correo@conatel.gob.ve"
                      {...field}
                      className="placeholder:text-white/60 hover:bg-slate-900/20"
                    />
                  </FormControl>
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
                  <FormLabel className="text-white font-medium">Contraseña:</FormLabel>
                  <div className="relative flex items-center">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Tu Contraseña"
                        className="pr-10 hover:bg-slate-900/20 placeholder:text-white"
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 text-slate-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 rounded p-0.5"
                      tabIndex={-1}
                      aria-label={showPassword ? "Ocultar clave" : "Mostrar clave"}
                      title={showPassword ? "Ocultar clave" : "Mostrar clave"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-end pt-1">
                    <Link
                      href="/recuperar-password"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-200 hover:text-white underline-offset-4 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-sm"
                    >
                      <KeyRound className="size-3.5 text-sky-300" />
                      <span>¿Olvidaste tu contraseña?</span>
                    </Link>
                  </div>
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
