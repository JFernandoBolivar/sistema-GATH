"use client";

import { useSession } from "next-auth/react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";

export function usePermisosDocumentos() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  return {
    puedeVer: tienePermiso(permisos, "documentos.ver_plantillas"),
    puedeGestionar: tienePermiso(permisos, "documentos.gestionar_plantillas"),
  };
}
