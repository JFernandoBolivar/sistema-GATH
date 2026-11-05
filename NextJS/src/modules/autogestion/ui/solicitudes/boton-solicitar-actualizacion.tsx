"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { FilePenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { usePoliticaAutogestion } from "./use-politica-autogestion";

/** Acceso a «Solicitar actualización» desde la ficha: permiso + configuración por condición (O12). */
export function BotonSolicitarActualizacion() {
  const { data: session } = useSession();
  const { politica } = usePoliticaAutogestion();
  const permitido =
    tienePermiso(session?.user?.permisos, "autogestion.solicitar_actualizacion") &&
    politica?.habilitado === true;
  if (!permitido) return null;
  return (
    <Button asChild size="lg" className="w-full sm:w-fit">
      <Link href="/autogestion/solicitudes/nueva">
        <FilePenLine aria-hidden /> Solicitar actualización de mis datos
      </Link>
    </Button>
  );
}
