"use client";

import type { ModuloNotificaciones } from "@/modules/notificaciones/domain/entities/notificacion";
import { CampanaNotificaciones } from "@/modules/notificaciones/ui/campana-notificaciones";
import { SignOut } from "@/components/signout-button";
import { BotonCambiarPassword } from "@/modules/auth/ui/boton-cambiar-password";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NOMBRE_ADMINISTRACION,
  SECCION_POR_RUTA,
} from "@/shared/lib/administracion-sistema";

export function HeaderLayout({
  children,
  title,
  subtitle,
  moduloNotificaciones,
  rutaNotificaciones,
}: Readonly<{
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Bandeja que muestra la campana de esta cabecera. */
  moduloNotificaciones: ModuloNotificaciones;
  /** Página de notificaciones del módulo actual («Ver todas»). */
  rutaNotificaciones: string;
}>) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeGestionarPersonal =
    tienePermiso(permisos, "personal.ver") && tienePermiso(permisos, "pasivos.ver");
  const pathName = usePathname().split("/");
  const pasivoPath = ["pasivos", "gestion-pasivos"];
  const activoPath = [
    "personal",
    "gestion-trabajadores",
    "familiares",
    "organizacion",
    "cargos",
    "movimientos",
    "reportes",
    "retroalimentacion",
  ];

  const isPasivo = pasivoPath.some((p) => pathName.includes(p));
  const isActivo = activoPath.some((p) => pathName.includes(p));
  const seccionAdministracion = SECCION_POR_RUTA[pathName[1] ?? ""];

  return (
    <header className="sticky top-0 z-50 flex w-full flex-row flex-wrap items-center justify-between border-b border-border bg-blue-900/100 px-3 py-3 shadow-sm sm:flex-nowrap sm:px-6 sm:py-4">
      <div className="w-full min-w-0 text-white sm:flex-1">
        <div className="flex flex-row justify-start gap-4">
          <div className="self-center">{children}</div>
          <div className="flex min-w-0 max-w-[38vw] flex-col sm:max-w-none">
            <h1 className="break-words text-base font-semibold leading-tight text-white sm:text-xl">{title}</h1>
            {subtitle && <p className="hidden break-words text-sm text-white sm:block">{subtitle}</p>}
            {seccionAdministracion && (
              <Breadcrumb className="text-white mt-1.5">
                <BreadcrumbList className="text-white text-sm">
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href="/dashboard">{NOMBRE_ADMINISTRACION}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-white">{seccionAdministracion}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
            {puedeGestionarPersonal && (isPasivo || isActivo) && (
              <Breadcrumb className="hidden text-white mt-1.5 cursor-pointer lg:block">
                <BreadcrumbList className="text-white">
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
                          <Link href={"/personal"}>
                            Gestión De Personal Activo
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" asChild>
                          <Link href={"/pasivos"}>
                            Gestión De Personal Pasivo
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                    </DropdownMenu>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 items-center justify-end gap-1 pr-7 sm:w-auto sm:gap-2 sm:pr-0">
        <CampanaNotificaciones
          variante="oscura"
          modulo={moduloNotificaciones}
          rutaBandeja={rutaNotificaciones}
        />
        <BotonCambiarPassword variante="oscura" />
        <SignOut />
      </div>
    </header>
  );
}
