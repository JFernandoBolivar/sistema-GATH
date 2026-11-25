"use client";

import { useSession } from "next-auth/react";

import { tienePermiso } from "@/shared/lib/evaluador-iam";

export function usePermisosDocumentos() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  return {
    puedeVer: tienePermiso(permisos, "documentos.ver_plantillas"),
    puedeGestionar: tienePermiso(permisos, "documentos.gestionar_plantillas"),
    puedeGenerarBajoDemanda: tienePermiso(permisos, "documentos.generar_bajo_demanda"),
    /** La API de procesos del Punto de Cuenta exige el permiso de configuración del sistema. */
    puedeConfigurarPuntoCuenta: tienePermiso(permisos, "configuracion.editar"),
  };
}
