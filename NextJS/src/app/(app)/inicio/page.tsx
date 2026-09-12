"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Loading from "@/shared/ui/components/loading";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cambiarPasswordFormSchema } from "@/modules/auth/ui/schema/schema-cambiar-password";
import { cambiarPasswordAction } from "@/modules/auth/infrastructure/actions/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MODULOS = [
  { href: "/usuarios", label: "Identidad / Usuarios", desc: "Gestión de cuentas y permisos" },
  { href: "/personal", label: "Personal", desc: "Empleados activos" },
  { href: "/cargos", label: "Cargos", desc: "Asignación y vacantes" },
  { href: "/familiares", label: "Cargas familiares", desc: "Familiares de empleados" },
  { href: "/organizacion", label: "Organización", desc: "Estructura organizacional" },
  { href: "/movimientos", label: "Movimientos", desc: "Historial de movimientos de cargo" },
  { href: "/pasivos", label: "Pasivos", desc: "Jubilados y pensionados" },
  { href: "/carnetizacion", label: "Carnetización", desc: "Carnets y plantillas" },
  { href: "/autogestion", label: "Autogestión", desc: "Censo de vivienda" },
  { href: "/reportes", label: "Reportes", desc: "Personal, pasivos y vacantes" },
  { href: "/catalogos", label: "Catálogos", desc: "Catálogos de solo lectura" },
];

/** Inicio de la arquitectura nueva (F8): reemplaza el selector de departamento de dashboard/page.tsx. */
export default function InicioPage() {
  const { data: session, status, update: updateSession } = useSession();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isChangingPass, startChangePass] = useTransition();

  const changeForm = useForm<z.infer<typeof cambiarPasswordFormSchema>>({
    resolver: zodResolver(cambiarPasswordFormSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  useEffect(() => {
    if (session?.user?.debeCambiarPassword) {
      setShowChangePassword(true);
    }
  }, [session?.user?.debeCambiarPassword]);

  async function onChangePassword(values: z.infer<typeof cambiarPasswordFormSchema>) {
    startChangePass(async () => {
      const response = await cambiarPasswordAction(values);
      if (response.success) {
        await updateSession({ debeCambiarPassword: false });
        setShowChangePassword(false);
      } else {
        changeForm.setError("current_password", {
          message: response.message || "Error al cambiar la contraseña",
        });
      }
    });
  }

  if (status === "loading") {
    return <Loading promiseMessage="Cargando Sesion" />;
  }

  return (
    <section className="flex flex-col gap-6 px-6 py-8">
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Sistema de Información Integral</h1>
        <p className="text-muted-foreground">Seleccione un módulo para acceder a sus funciones</p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex flex-col gap-1 rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-accent/50"
          >
            <span className="font-medium">{m.label}</span>
            <span className="text-sm text-muted-foreground">{m.desc}</span>
          </Link>
        ))}
      </div>

      <Dialog
        open={showChangePassword}
        onOpenChange={(open) => {
          if (!open) return;
          setShowChangePassword(open);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Debe cambiar su contraseña para continuar. Esta es una medida de
              seguridad obligatoria.
            </DialogDescription>
          </DialogHeader>

          <Form {...changeForm}>
            <form
              onSubmit={changeForm.handleSubmit(onChangePassword)}
              className="gap-4"
            >
              <FormField
                control={changeForm.control}
                name="current_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña Actual</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={changeForm.control}
                name="new_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={changeForm.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isChangingPass} className="w-full">
                {isChangingPass ? "Cambiando..." : "Cambiar Contraseña"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
