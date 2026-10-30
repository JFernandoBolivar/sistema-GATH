"use client";

/**
 * Botón de cabecera para que cualquier usuario autenticado (autogestión o
 * administración) cambie su contraseña cuando quiera. Reutiliza el diálogo
 * del cambio obligatorio en modo descartable.
 */
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import CambiarPasswordDialog from "./cambiar-password-dialog";

interface Props {
  variante?: "oscura" | "clara";
  className?: string;
}

export function BotonCambiarPassword({ variante = "clara", className }: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Cambiar contraseña"
        title="Cambiar contraseña"
        className={cn(
          "size-11",
          variante === "oscura" && "text-white hover:bg-white/15 hover:text-white",
          className,
        )}
        onClick={() => setAbierto(true)}
      >
        <KeyRound aria-hidden className="size-5" />
      </Button>
      <CambiarPasswordDialog
        open={abierto}
        obligatorio={false}
        onCerrar={() => setAbierto(false)}
        onCambiada={() => {
          setAbierto(false);
          toast.success("Contraseña actualizada.");
        }}
      />
    </>
  );
}
