"use client";

import { useSession } from "next-auth/react";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

/** Permisos por código y cédula de la sesión (nunca el nombre del rol). */
export function useSesionFeDeVida() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  return {
    permisos,
    cedula: session?.user?.cedula ?? null,
    puede: (codigo: string) => tienePermiso(permisos, codigo),
  };
}
