"use client";

/**
 * Botón de cierre de sesión — paridad con el legado (`components/signout-button.tsx`).
 * Vive en `modules/auth/ui/` (en vez de `src/components/`, ruta legada) y usa
 * los primitivos de `@/shared/ui/components`, consistente con el resto de la
 * reconstrucción de `ui/` de este módulo.
 */
import { LogOut } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/components/button";
import { cerrarSesionAction } from "../infrastructure/actions/auth-actions";

export default function LogoutButton() {
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
    <Button variant="destructive" onClick={handleSignOut} disabled={isLoggingOut}>
      <LogOut className="size-4" aria-hidden="true" />
    </Button>
  );
}
