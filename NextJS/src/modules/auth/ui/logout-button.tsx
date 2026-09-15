"use client";

/**
 * Botón de cierre de sesión — paridad con el legado (`components/signout-button.tsx`).
 * Vive en `modules/auth/ui/` (en vez de `src/components/`, ruta legada) y usa
 * los primitivos de `@/shared/ui/components`, consistente con el resto de la
 * reconstrucción de `ui/` de este módulo.
 */
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/shared/ui/components/button";
import { cerrarSesionAction } from "../infrastructure/actions/auth-actions";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await cerrarSesionAction();
    router.push("/login");
  };

  return (
    <Button variant="destructive" onClick={handleSignOut} disabled={isLoggingOut}>
      <LogOut className="size-4" aria-hidden="true" />
    </Button>
  );
}
