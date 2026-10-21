"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { ArrowLeft, MailCheck, AlertCircle } from "lucide-react";

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
import {
  solicitarRecuperacionSchema,
  type SolicitarRecuperacionFormType,
} from "./schema/schema-recuperar-password";
import { solicitarRecuperacionAction } from "../infrastructure/actions/auth-actions";

export default function RecuperarPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  const form = useForm<SolicitarRecuperacionFormType>({
    resolver: zodResolver(solicitarRecuperacionSchema),
    defaultValues: { identificador: "" },
  });

  function onSubmit(values: SolicitarRecuperacionFormType) {
    setError(null);
    startTransition(async () => {
      const result = await solicitarRecuperacionAction(values);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setEnviado(true);
      setMensajeExito(result.message);
    });
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-6 text-center text-white py-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
          <MailCheck className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">Solicitud Procesada</h2>
          <p className="text-sm text-slate-200 leading-relaxed">
            {mensajeExito ||
              "Si el usuario o cédula corresponde a un trabajador activo, se ha enviado un correo con instrucciones a su dirección institucional (@conatel.gob.ve)."}
          </p>
          <p className="text-xs text-slate-300 mt-2">
            El enlace de recuperación tiene una validez de <strong>15 minutos</strong>.
          </p>
        </div>
        <Link href="/login" className="w-full">
          <Button variant="outline" className="w-full text-slate-900 bg-white hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio de Sesión
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Recuperar Contraseña</h1>
          <p className="text-sm text-slate-200">
            Ingresa tu cédula o correo institucional para recibir el enlace de recuperación.
          </p>
        </div>

        <div className="grid gap-6">
          <div className="grid gap-3">
            <FormField
              control={form.control}
              name="identificador"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cédula o Correo Institucional:</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej. V-12345678 o usuario@conatel.gob.ve"
                      {...field}
                      className="placeholder:text-slate-300 text-white hover:bg-slate-900/20"
                    />
                  </FormControl>
                  <FormDescription className="text-slate-200">
                    Se enviará un enlace seguro a su correo de expediente CONATEL.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-red-950/60 border border-red-500/40 rounded-md text-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Procesando..." : "Enviar Enlace de Recuperación"}
          </Button>

          <div className="flex justify-center pt-2">
            <Link
              href="/login"
              className="inline-flex items-center text-xs text-blue-200 hover:text-white underline-offset-4 hover:underline transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver al Inicio de Sesión
            </Link>
          </div>
        </div>
      </form>
    </Form>
  );
}
