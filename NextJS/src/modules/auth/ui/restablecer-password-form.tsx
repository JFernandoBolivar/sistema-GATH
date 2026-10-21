"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { CheckCircle2, AlertCircle, ArrowLeft, KeyRound, ShieldCheck, Eye, EyeOff } from "lucide-react";

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
  restablecerPasswordSchema,
  type RestablecerPasswordFormType,
} from "./schema/schema-recuperar-password";
import { restablecerPasswordAction } from "../infrastructure/actions/auth-actions";

interface RestablecerPasswordFormProps {
  tokenInicial?: string;
}

export default function RestablecerPasswordForm({ tokenInicial = "" }: RestablecerPasswordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [showPasswordNuevo, setShowPasswordNuevo] = useState(false);
  const [showPasswordConfirmacion, setShowPasswordConfirmacion] = useState(false);

  const form = useForm<RestablecerPasswordFormType>({
    resolver: zodResolver(restablecerPasswordSchema),
    defaultValues: {
      token: tokenInicial,
      passwordNuevo: "",
      passwordConfirmacion: "",
    },
  });

  if (!tokenInicial && !form.getValues("token")) {
    return (
      <div className="flex flex-col items-center gap-6 text-center text-white py-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
          <AlertCircle className="w-8 h-8 text-amber-400" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">Enlace Incompleto o Inválido</h2>
          <p className="text-sm text-slate-200">
            No se ha encontrado el token de recuperación en el enlace recibido.
          </p>
          <p className="text-xs text-slate-300 mt-2">
            Asegúrese de abrir el enlace completo que llegó a su correo institucional o solicite uno nuevo.
          </p>
        </div>
        <Link href="/recuperar-password" className="w-full">
          <Button variant="outline" className="w-full text-slate-900 bg-white hover:bg-slate-100">
            Solicitar Nuevo Enlace
          </Button>
        </Link>
      </div>
    );
  }

  function onSubmit(values: RestablecerPasswordFormType) {
    setError(null);
    startTransition(async () => {
      const result = await restablecerPasswordAction(values);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setExito(true);
      setMensajeExito(result.message);
    });
  }

  if (exito) {
    return (
      <div className="flex flex-col items-center gap-6 text-center text-white py-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">¡Contraseña Actualizada!</h2>
          <p className="text-sm text-slate-200 leading-relaxed">
            {mensajeExito || "Tu contraseña ha sido restablecida exitosamente."}
          </p>
          <p className="text-xs text-slate-300 mt-2">
            Ya puedes iniciar sesión en el sistema GATH con tus nuevas credenciales.
          </p>
        </div>
        <Link href="/login" className="w-full">
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
            <KeyRound className="w-4 h-4 mr-2" /> Iniciar Sesión Ahora
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-1 border border-blue-500/30">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold">Nueva Contraseña</h1>
          <p className="text-sm text-slate-200">
            Crea una nueva contraseña segura para tu cuenta de acceso institucional.
          </p>
        </div>

        <div className="grid gap-4">
          <FormField
            control={form.control}
            name="passwordNuevo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nueva Contraseña:</FormLabel>
                <div className="relative flex items-center">
                  <FormControl>
                    <Input
                      type={showPasswordNuevo ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      {...field}
                      className="pr-10 placeholder:text-slate-300 text-white hover:bg-slate-900/20"
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowPasswordNuevo((prev) => !prev)}
                    className="absolute right-3 text-slate-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 rounded p-0.5"
                    tabIndex={-1}
                    aria-label={showPasswordNuevo ? "Ocultar clave" : "Mostrar clave"}
                    title={showPasswordNuevo ? "Ocultar clave" : "Mostrar clave"}
                  >
                    {showPasswordNuevo ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <FormDescription className="text-xs text-slate-200">
                  Debe tener al menos 8 caracteres, números y letras.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="passwordConfirmacion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar Contraseña:</FormLabel>
                <div className="relative flex items-center">
                  <FormControl>
                    <Input
                      type={showPasswordConfirmacion ? "text" : "password"}
                      placeholder="Repite la nueva contraseña"
                      {...field}
                      className="pr-10 placeholder:text-slate-300 text-white hover:bg-slate-900/20"
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirmacion((prev) => !prev)}
                    className="absolute right-3 text-slate-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 rounded p-0.5"
                    tabIndex={-1}
                    aria-label={showPasswordConfirmacion ? "Ocultar clave" : "Mostrar clave"}
                    title={showPasswordConfirmacion ? "Ocultar clave" : "Mostrar clave"}
                  >
                    {showPasswordConfirmacion ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-red-950/60 border border-red-500/40 rounded-md text-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={isPending} className="w-full mt-2">
            {isPending ? "Restableciendo..." : "Guardar Nueva Contraseña"}
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
