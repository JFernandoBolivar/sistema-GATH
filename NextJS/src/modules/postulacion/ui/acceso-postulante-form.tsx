"use client";

/**
 * Pantalla de acceso del postulante (D-6): cédula y contraseña. Distinta del login del personal.
 * Los mensajes salen del código de error del servidor y nunca revelan si la cédula está registrada.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Clock, LogIn } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputPassword } from "@/shared/ui/components/input-password";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { credencialesPostulanteSchema, type CredencialesPostulante } from "../domain/credenciales";
import { mensajeDeAcceso } from "../domain/errores-acceso";
import { RUTA_POSTULACION } from "../domain/acceso-ruta";
import { iniciarSesionPostulanteAction } from "../infrastructure/actions/postulacion-actions";

export function AccesoPostulanteForm({ sesionTerminada = false }: { sesionTerminada?: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [fallo, setFallo] = useState<{ mensaje: string; bloqueado: boolean } | null>(null);

  const form = useForm<CredencialesPostulante>({
    resolver: zodResolver(credencialesPostulanteSchema),
    defaultValues: { cedula: "", password: "" },
  });

  function enviar(valores: CredencialesPostulante) {
    setFallo(null);
    iniciar(async () => {
      const resultado = await iniciarSesionPostulanteAction(valores);
      if (!resultado.ok) {
        setFallo({
          mensaje: resultado.mensaje,
          bloqueado: resultado.codigo === "CREDENCIAL_BLOQUEADA",
        });
        return;
      }
      // Navegación dura: así el layout del servidor se vuelve a dibujar con la sesión nueva.
      window.location.href = RUTA_POSTULACION;
    });
  }

  const aviso = !fallo && sesionTerminada ? mensajeDeAcceso({ codigo: "SESION_INVALIDA" }) : null;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-2xl border bg-card p-6 shadow-lg sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LogIn className="size-7" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-balance">Portal del postulante</h1>
          <p className="mt-2 text-base text-muted-foreground text-pretty">
            Ingresa con tu cédula y la contraseña que te entregó Captación.
          </p>
        </div>

        {fallo && (
          <Alert variant="destructive" className="mb-5">
            {fallo.bloqueado ? <Clock aria-hidden /> : <AlertCircle aria-hidden />}
            <AlertTitle>{fallo.bloqueado ? "Acceso bloqueado por un rato" : "No pudimos ingresarte"}</AlertTitle>
            <AlertDescription>{fallo.mensaje}</AlertDescription>
          </Alert>
        )}
        {aviso && (
          <Alert className="mb-5">
            <AlertCircle aria-hidden />
            <AlertTitle>Tu sesión terminó</AlertTitle>
            <AlertDescription>{aviso}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(enviar)} className="flex flex-col gap-5" noValidate>
            <FormField
              control={form.control}
              name="cedula"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cédula de identidad</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={10}
                      placeholder="Ej. 12345678"
                      className="h-12 text-base"
                      onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                    />
                  </FormControl>
                  <FormDescription>Solo números, sin puntos ni letras.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <InputPassword
                      {...field}
                      autoComplete="current-password"
                      maxLength={128}
                      placeholder="Tu contraseña"
                      className="h-12 text-base"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="lg" disabled={pendiente} className="w-full">
              {pendiente ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-center text-sm text-muted-foreground text-pretty">
          ¿No tienes contraseña o no funciona? Pídele ayuda a Captación en persona.
        </p>
      </div>

      <p className="mt-5 text-center text-sm">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-sm px-2 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ¿Eres trabajador de CONATEL? Ingresa aquí
        </Link>
      </p>
    </div>
  );
}
