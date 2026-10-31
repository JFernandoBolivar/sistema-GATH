"use client";

/**
 * Portada de «Administración del sistema → Configuración» (D9). Reúne los
 * parámetros del sistema y la identidad visual, y deja reservado el espacio de
 * «Documentos por movimiento» (G5) sin implementar su pantalla.
 */
import Link from "next/link";
import { Settings, Image as ImageIcon, FileText } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RUTA_PARAMETROS,
  RUTA_VISUAL,
} from "@/shared/lib/administracion-sistema";

export function ConfiguracionHomePage() {
  return (
    <PageLayout
      title="Configuración"
      description="Parámetros que aplican sin reiniciar y la identidad visual del cintillo institucional."
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

        <Card className="h-full border-dashed" aria-disabled="true">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText aria-hidden /> Documentos por movimiento
              <Badge variant="secondary">Espacio reservado</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Aquí se configurarán las reglas, tipos y plantillas de documentos por movimiento (G5).
            Todavía no tiene pantalla.
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
