"use client";

/**
 * Imagen real del carnet vigente (T1, OC 2026-11-11).
 *
 * Pide el PNG al endpoint Zero-IDOR `/api/v1/autogestion/mi-carnet/vista-previa/`
 * (mismo origen, proxy autenticado) en vez de dibujar un carnet a mano.
 * Estados: cargando, imagen, sin carnet (404) y error.
 */
import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

type Estado = "cargando" | "lista" | "sin-carnet" | "error";

interface Resultado {
  cedula: string;
  estado: Estado;
  src: string | null;
}

export function CarnetReal({
  cedula,
  alt = "Carnet institucional",
  className = "",
}: {
  cedula: string;
  alt?: string;
  className?: string;
}) {
  // Estado por cédula: al cambiar de titular se vuelve a «Cargando…» sin
  // escribir estado dentro del efecto (regla react-hooks/set-state-in-effect).
  const [resultado, setResultado] = useState<Resultado>({
    cedula,
    estado: "cargando",
    src: null,
  });
  const estado = resultado.cedula === cedula ? resultado.estado : "cargando";
  const src = resultado.cedula === cedula ? resultado.src : null;

  useEffect(() => {
    let activo = true;
    let url: string | null = null;

    fetch("/api/v1/autogestion/mi-carnet/vista-previa/", {
      method: "GET",
      headers: { Accept: "image/png" },
      cache: "no-store",
    })
      .then(async (respuesta) => {
        if (!activo) return;
        if (respuesta.status === 404) {
          setResultado({ cedula, estado: "sin-carnet", src: null });
          return;
        }
        if (!respuesta.ok) {
          setResultado({ cedula, estado: "error", src: null });
          return;
        }
        const blob = await respuesta.blob();
        if (!activo) return;
        url = URL.createObjectURL(blob);
        setResultado({ cedula, estado: "lista", src: url });
      })
      .catch(() => {
        if (activo) setResultado({ cedula, estado: "error", src: null });
      });

    return () => {
      activo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [cedula]);

  if (estado === "cargando") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex min-h-56 w-full flex-col items-center justify-center gap-2 rounded-xl border bg-muted/20 p-6 text-sm text-muted-foreground ${className}`}
      >
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        Cargando…
      </div>
    );
  }

  if (estado === "sin-carnet") {
    return (
      <div
        role="alert"
        className={`flex min-h-56 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground ${className}`}
      >
        <AlertCircle className="size-6" aria-hidden="true" />
        No posee un carnet activo emitido.
      </div>
    );
  }

  if (estado === "error" || !src) {
    return (
      <div
        role="alert"
        className={`flex min-h-56 w-full flex-col items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive ${className}`}
      >
        <AlertCircle className="size-6" aria-hidden="true" />
        No fue posible cargar la imagen del carnet. Intente nuevamente.
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`w-full rounded-xl border shadow-sm ${className}`}
    />
  );
}
