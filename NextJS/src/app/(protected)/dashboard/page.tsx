"use client";
import { SignOut } from "@/components/signout-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Loading from "./gestion-trabajadores/components/loading/loading";
import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { changePasswordSchema } from "@/lib/zod";
import { changePasswordAction } from "#/actions/auth-actions";
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
type Department = {
  id: string;
  name: string;
  imageSrc: string;
  href: string;
  color: string;
  alt: string;
};
const departments: Department[] = [
  {
    id: "Seguridad",
    name: "Seguridad",
    imageSrc: "/images/departments/seguridad.jpg",
    href: "/dashboard/seguridad",
    color: "bg-green-500",
    alt: "Sección de seguridad y privacidad.",
  },
  {
    id: "RAC",
    name: "Gestión de Trabajadores",
    imageSrc: "/images/departments/datos.jpg",
    href: "/dashboard/gestion-trabajadores",
    color: "bg-green-500",
    alt: "Human Resources Department",
  },
  {
    id: "Carnetizacion",
    name: "Carnetización",
    imageSrc: "/images/departments/carnetizacion.png",
    href: "/dashboard/carnetizacion",
    color: "bg-blue-500",
    alt: "Sistema de Carnetización",
  },
  {
    id: "AUTOGESTION",
    name: "Autogestión",
    imageSrc: "/images/departments/datos.jpg",
    href: "/dashboard/autogestion",
    color: "bg-emerald-500",
    alt: "Autogestión de Personal",
  },
];

export default function Dashboard() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isChangingPass, startChangePass] = useTransition();

  const changeForm = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      new_password: "",
      confirm_password: "",
    },
  });

  useEffect(() => {
    if (session?.user?.debeCambiarPassword) {
      setShowChangePassword(true);
    }
  }, [session?.user?.debeCambiarPassword]);

  async function onChangePassword(values: z.infer<typeof changePasswordSchema>) {
    const userId = Number(session?.user?.id);
    if (!userId) return;

    startChangePass(async () => {
      const response = await changePasswordAction(userId, values.new_password);
      if (response.success) {
        await updateSession();
        setShowChangePassword(false);
      } else {
        changeForm.setError("new_password", {
          message: response.message || "Error al cambiar la contraseña",
        });
      }
    });
  }

  if (status === "loading") {
    return <Loading promiseMessage="Cargando Sesion" />;
  }

  return (
    <>
      <div className="flex flex-col items-center mb-10 mt-4">
        <h1 className="text-3xl font-bold mb-2 text-white text-center">
          Sistema de Información Integral
        </h1>
        <p className=" text-2xl text-center text-white ">
          Seleccione un módulo para acceder a sus funciones
        </p>
        <SignOut />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mx-8 ">
        {departments
          .filter(
            (d) => d.id === session?.user?.department.nombre_departamento,
          )
          .map((department, index) => (
            <Card
              key={index}
              onClick={() => router.push(department.href)}
              className="block transition-all duration-200 p-0 hover:scale-105 cursor-pointer"
            >
              <div
                dir="rtl"
                className="relative w-fit top-4 end-0 z-10 bg-green-700 text-white p-1 rounded-full"
              >
                <Check size={18} />
              </div>
              <Image
                height={150}
                width={100}
                src={department.imageSrc}
                alt={department.alt}
                className="w-full h-60 object-contain overflow-hidden relative"
              />
              <Card className="rounded text-center bg-slate-200/25 ">
                <CardHeader>
                  <CardTitle className="text-xl">{department.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center h-full">
                  <p className="text-sm text-gray-700">
                    Tienes acceso a este departamento.
                  </p>
                </CardContent>
              </Card>
            </Card>
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
              className="space-y-4"
            >
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
              <Button
                type="submit"
                disabled={isChangingPass}
                className="w-full"
              >
                {isChangingPass ? "Cambiando..." : "Cambiar Contraseña"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
