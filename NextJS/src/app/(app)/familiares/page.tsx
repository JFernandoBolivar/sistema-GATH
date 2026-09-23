"use client";

import Link from "next/link";
import { BookUser, ContactRound } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Bienvenida de "Cargas Familiares", paridad de patrón con `/personal` (R10). */
export default function FamiliaresWelcomePage() {
  return (
    <PageLayout>
      <div className="flex flex-col items-center justify-center py-12">
        <h1 className="text-3xl font-semibold text-center">Cargas Familiares</h1>
        <p className="text-center text-muted-foreground mt-2">
          Registro y consulta de familiares de los trabajadores
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 w-full max-w-2xl px-4">
          <Card className="hover:shadow-lg transition-shadow border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookUser className="size-5 text-blue-600" />
                Consultar Familiar
              </CardTitle>
              <CardDescription>
                Búsqueda por cédula del empleado y listado de sus cargas familiares.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-blue-700 hover:bg-blue-800">
                <Link href="/familiares/consultar">Ir a Consultar Familiar</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ContactRound className="size-5 text-emerald-600" />
                Agregar Familiar
              </CardTitle>
              <CardDescription>
                Registro de una nueva carga familiar para un empleado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                <Link href="/familiares/registrar">Agregar Familiar</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
