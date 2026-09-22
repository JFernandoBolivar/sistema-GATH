"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { ListCheck, UserPlus } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PersonalWelcomePage() {
  const { data: session } = useSession();

  return (
    <PageLayout>
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-8xl text-center text-clip text-transparent bg-clip-text from-cyan-900 bg-linear-to-r to-purple-500 animate-gradient mt-20">
          Bienvenid@ a <span className="underline">GATH</span>
        </h1>
        <h2 className="text-center text-6xl text-clip text-transparent bg-clip-text from-blue-600 bg-linear-to-r to-blue-900 select-none animate-pulse mt-4">
          {session?.user?.name}
        </h2>
        <p className="text-center text-xl text-gray-500 mt-4">
          Gestión y Visualización de la Información de los Trabajadores de CONATEL
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 w-full max-w-2xl px-4">
          <Card className="hover:shadow-lg transition-shadow border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ListCheck className="size-5 text-blue-600" />
                Consultar Trabajadores
              </CardTitle>
              <CardDescription>
                Búsqueda por cédula, código o tipo de nómina, visualización de expedientes y exportación PDF.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-blue-700 hover:bg-blue-800">
                <Link href="/personal/consultar">
                  Ir a Consultar / Actualizar
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="size-5 text-emerald-600" />
                Registrar Trabajador
              </CardTitle>
              <CardDescription>
                Captación y recopilación de expediente en pasos estratégicos del nuevo personal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                <Link href="/personal/registrar">
                  Registrar Nuevo Ingreso
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
