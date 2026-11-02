"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cerrarSesionAction } from "@/modules/auth/infrastructure/actions/auth-actions";
import { useState } from "react";

export function SignOut() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await cerrarSesionAction();
    // Navegacion dura (no router.push): el Router Cache de Next.js puede
    // reutilizar una entrada prefetcheada/visitada antes del logout (con
    // session activa). Un location.href fuerza una carga completa que
    // re-ejecuta el RootLayout ya sin sesion en /login.
    window.location.href = "/login";
  };

  return (
    <Button
      variant={"destructive"}
      onClick={handleSignOut}
      disabled={isLoggingOut}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
    >
      <LogOut aria-hidden />
    </Button>
  );
}
