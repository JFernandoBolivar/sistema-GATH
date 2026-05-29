"use client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { signInSchema } from "@/lib/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { loginAction } from "#/actions/auth-actions";
import { useRouter } from "next/navigation";
import Loading from "@/app/(protected)/dashboard/gestion-trabajadores/components/loading/loading";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof signInSchema>) {
    setError(null);
    startTransition(async () => {
      const response = await loginAction(values);
      if (response?.error) {
        setError(response.error);
      } else {
        router.push("/dashboard");
      }
    });
  }

  return (
    <Form {...form}>
      {isPending ? (
        <Loading
          className="bg-transparent border-none text-white shadow-none"
          promiseMessage="Validando Credenciales"
        />
      ) : (
        <form
          className={cn("flex flex-col gap-6 ", className)}
          {...props}
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold">
              Inicia Sesión Con Tus Credenciales
            </h1>
          </div>
          <div className="grid gap-6 ">
            <div className="grid gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico:</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="correo@conatel.gob.ve"
                        {...field}
                        className={
                          "transition-property: all transition-duration: 300ms placeholder:text-white hover:bg-slate-900/20"
                        }
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
                        type={"password"}
                        placeholder="Tu Contraseña"
                        className=" hover:bg-slate-900/20 placeholder:text-white"
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
      )}
    </Form>
  );
}
