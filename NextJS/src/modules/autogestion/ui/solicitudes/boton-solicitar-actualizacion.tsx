"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { FilePenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cumpleCondicion, tienePermiso } from "@/shared/lib/evaluador-iam";

/** Acceso a «Solicitar actualización» desde la ficha: solo con el permiso y la condición de trabajador activo. */
export function BotonSolicitarActualizacion() {
  const { data: session } = useSession();
  const permitido =
    tienePermiso(session?.user?.permisos, "autogestion.solicitar_actualizacion") &&
    cumpleCondicion("ACTIVO", session?.user?.condicionTrabajador);
  if (!permitido) return null;
  return (
    <Button asChild size="lg" className="w-full sm:w-fit">
      <Link href="/autogestion/solicitudes/nueva">
        <FilePenLine aria-hidden /> Solicitar actualización de mis datos
      </Link>
    </Button>
  );
}
