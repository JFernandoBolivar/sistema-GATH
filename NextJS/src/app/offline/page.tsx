"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

import { Button } from "@/shared/ui/components/button";

export default function OfflinePage() {
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-muted">
        <WifiOff className="size-8 text-muted-foreground" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">Sin conexión</h1>
      <p className="max-w-md text-base text-muted-foreground">
        No pudimos cargar esta sección. Revise su conexión e inténtelo de nuevo.
      </p>
      <Button type="button" onClick={() => window.location.reload()} className="min-h-11">
        Reintentar
      </Button>
      {enLinea ? (
        <p role="status" className="text-sm text-muted-foreground">
          La conexión parece estar disponible.
        </p>
      ) : null}
    </main>
  );
}
