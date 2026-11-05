"use client";

import { useState } from "react";
import { Camera, ChevronDown, ChevronUp, HelpCircle, Lock, RefreshCw, Smartphone, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  className?: string;
}

type Plataforma = "android" | "ios";

/**
 * Guía visual paso a paso para conceder o reactivar el permiso de la cámara en Android e iOS.
 * Incluye aclaración de la cámara frontal por defecto y alternativa de subida de archivo.
 */
export function AyudaPermisoCamara({ className = "" }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [plataforma, setPlataforma] = useState<Plataforma>("android");

  return (
    <div
      className={`rounded-lg border border-border/80 bg-card p-3 shadow-xs ${className}`}
      data-testid="ayuda-permiso-camara"
    >
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between text-left font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md p-1"
        aria-expanded={abierto}
        aria-controls="instrucciones-permiso-camara"
      >
        <span className="flex items-center gap-2 text-base font-semibold">
          <HelpCircle className="size-5 shrink-0 text-primary" aria-hidden />
          ¿Problemas con el permiso de la cámara? Toque aquí
        </span>
        {abierto ? (
          <ChevronUp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>

      {abierto ? (
        <div id="instrucciones-permiso-camara" className="mt-3 flex flex-col gap-4 pt-2 border-t">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Plataforma del dispositivo">
            <Button
              type="button"
              variant={plataforma === "android" ? "default" : "outline"}
              size="sm"
              role="tab"
              aria-selected={plataforma === "android"}
              onClick={() => setPlataforma("android")}
              className="gap-2"
            >
              <Smartphone className="size-4" aria-hidden /> En teléfonos Android (Chrome)
            </Button>
            <Button
              type="button"
              variant={plataforma === "ios" ? "default" : "outline"}
              size="sm"
              role="tab"
              aria-selected={plataforma === "ios"}
              onClick={() => setPlataforma("ios")}
              className="gap-2"
            >
              <Smartphone className="size-4" aria-hidden /> En iPhone / iPad (Safari)
            </Button>
          </div>

          {plataforma === "android" ? (
            <div className="flex flex-col gap-2.5 text-base" data-testid="guia-android">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Lock className="size-4 text-primary" aria-hidden /> Cómo activar la cámara en Android (Google Chrome):
              </h3>
              <ol className="list-decimal pl-6 flex flex-col gap-1.5 leading-relaxed">
                <li>
                  Toque el ícono de <strong>candado 🔒</strong> o ajustes ubicado en la barra de direcciones (donde dice la dirección web arriba).
                </li>
                <li>
                  Seleccione la opción <strong>«Permisos»</strong> o <strong>«Configuración de sitios»</strong>.
                </li>
                <li>
                  Busque <strong>«Cámara»</strong> y actívelo en <strong>«Permitir»</strong>.
                </li>
                <li>
                  Cierre el panel y <strong>recargue la página</strong>. La cámara se abrirá automáticamente.
                </li>
              </ol>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 text-base" data-testid="guia-ios">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Lock className="size-4 text-primary" aria-hidden /> Cómo activar la cámara en iPhone / iPad (Safari):
              </h3>
              <ol className="list-decimal pl-6 flex flex-col gap-1.5 leading-relaxed">
                <li>
                  En la barra de direcciones, toque el botón <strong>«aA»</strong> (o el icono de opciones de página).
                </li>
                <li>
                  Toque en <strong>«Configuración de sitios web»</strong>.
                </li>
                <li>
                  En el apartado <strong>«Cámara»</strong>, elija la opción <strong>«Permitir»</strong>.
                </li>
                <li>
                  Si continúa bloqueada, ingrese a <strong>Ajustes del iPhone &gt; Safari &gt; Cámara</strong> y seleccione «Permitir».
                </li>
              </ol>
            </div>
          )}

          <div className="rounded-md bg-muted/70 p-3 text-sm flex flex-col gap-2">
            <p className="flex items-start gap-2">
              <Camera className="size-4 shrink-0 text-primary mt-0.5" aria-hidden />
              <span>
                <strong>Cámara frontal por defecto:</strong> El sistema activa la cámara frontal (selfie) para que pueda sostener su cédula al lado de su rostro. Si desea usar la cámara trasera, use el botón «Cambiar cámara».
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Upload className="size-4 shrink-0 text-primary mt-0.5" aria-hidden />
              <span>
                <strong>¿Prefiere no usar la cámara?</strong> Puede usar la pestaña <strong>«Subir foto»</strong> para seleccionar una foto guardada en su galería o archivos.
              </span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
