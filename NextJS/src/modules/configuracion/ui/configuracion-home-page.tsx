"use client";

/**
 * Portada de «Administración del sistema → Configuración» (D9).
 */
import Link from "next/link";
import { Settings, Image as ImageIcon, FileText, SlidersHorizontal, Mail } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RUTA_PARAMETROS,
  RUTA_VISUAL,
  RUTA_PUNTO_CUENTA,
  RUTA_REGLAS_CATALOGOS,
  RUTA_CORREO_ACCESO,
} from "@/shared/lib/administracion-sistema";

export function ConfiguracionHomePage() {
  return (
    <PageLayout
      title="Configuración"
      description="Parámetros del sistema, identidad visual, reglas de catálogos, puntos de cuenta y correo de acceso."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href={RUTA_PARAMETROS} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings aria-hidden /> Parámetros del sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Notificaciones por correo, plazos de contraseña y autogestión, y recordatorios de fe de vida.
            </CardContent>
          </Card>
        </Link>

        <Link href={RUTA_REGLAS_CATALOGOS} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal aria-hidden /> Reglas de catálogos
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Parentescos permitidos para familiares, motivos por categoría de movimiento y marcas de tipos de nómina.
            </CardContent>
          </Card>
        </Link>

        <Link href={RUTA_VISUAL} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon aria-hidden /> Identidad visual
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Cintillo, logos y nombre institucional que usan los documentos en PDF.
            </CardContent>
          </Card>
        </Link>

        <Link href={RUTA_PUNTO_CUENTA} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText aria-hidden /> Punto de cuenta
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Interruptor general, procesos administrativos que generan punto de cuenta y formato personalizable del documento PDF.
            </CardContent>
          </Card>
        </Link>

        <Link href={RUTA_CORREO_ACCESO} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail aria-hidden /> Correo de acceso
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Política general de resolución de correos de acceso (activos y pasivos), fallbacks y aplicación masiva con vista previa.
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageLayout>
  );
}
