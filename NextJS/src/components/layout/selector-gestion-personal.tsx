"use client";

/**
 * Selector «Gestión Personal Activo / Pasivo».
 *
 * En escritorio vive en la cabecera (≥ 1024 px); en teléfono se muestra arriba
 * del menú lateral, porque la cabecera no tiene sitio. Solo aparece para quien
 * puede ver ambos módulos (`personal.ver` y `pasivos.ver`) y está dentro de una
 * ruta de gestión de personal.
 */
import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { cn } from "@/lib/utils";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

const RUTAS_PASIVO = ["pasivos", "gestion-pasivos"];
const RUTAS_ACTIVO = [
  "personal",
  "gestion-trabajadores",
  "familiares",
  "organizacion",
  "cargos",
  "movimientos",
  "reportes",
  "retroalimentacion",
];

export function SelectorGestionPersonal({
  className,
  tono = "oscuro",
}: {
  className?: string;
  /** `oscuro` para la cabecera azul; `claro` para el menú lateral blanco. */
  tono?: "oscuro" | "claro";
}) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeGestionarPersonal =
    tienePermiso(permisos, "personal.ver") && tienePermiso(permisos, "pasivos.ver");

  const pathName = usePathname().split("/");
  const isPasivo = RUTAS_PASIVO.some((p) => pathName.includes(p));
  const isActivo = RUTAS_ACTIVO.some((p) => pathName.includes(p));

  if (!puedeGestionarPersonal || (!isPasivo && !isActivo)) return null;

  return (
    <Breadcrumb
      className={cn("cursor-pointer", tono === "oscuro" && "text-white", className)}
    >
      <BreadcrumbList className={cn(tono === "oscuro" && "text-white")}>
        <BreadcrumbItem className="contents">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="flex items-center gap-1 text-[1rem] cursor-pointer"
                variant={"secondary"}
              >
                {isPasivo
                  ? "Gestion Personal Pasivo"
                  : isActivo
                    ? "Gestion Personal Activo"
                    : "Gestión Personal"}
                <ChevronDownIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <Link href={"/personal"}>Gestión De Personal Activo</Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <Link href={"/pasivos"}>Gestión De Personal Pasivo</Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
