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
    <Button
      asChild
      size="lg"
      className="w-full sm:w-fit h-auto min-h-11 py-2.5 px-4 text-xs sm:text-sm whitespace-normal text-center leading-snug shadow-sm"
      data-guia-id="inicio-boton-solicitar"
    >
      <Link href="/autogestion/solicitudes/nueva" className="inline-flex items-center justify-center gap-2">
        <FilePenLine className="h-4 w-4 shrink-0" aria-hidden />
        <span>Solicitar actualización de mis datos</span>
      </Link>
    </Button>
  );
}
