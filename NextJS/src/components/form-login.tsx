"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { signInSchema } from "@/lib/zod";
import { Button } from "@/components/ui/button";
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
export default function FormRegister() {
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
    <>
      <div className="w-full max-w-sm space-y-8 rounded-lg border p-4 text-white bg-blue-600">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                        "transition-property: all transition-duration: 300ms hover:bg-slate-100"
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Introduce tu correo electrónico institucional.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      className="hover:bg-slate-100"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Coloque su contraseña de acceso.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {error && <FormMessage>{error}</FormMessage>}
            <Button type="submit" disabled={isPending} className="w-full">
              Iniciar Sesión
            </Button>
          </form>
        </Form>
      </div>
    </>
  );
}
