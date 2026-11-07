"use client";

import type { ModuloNotificaciones } from "@/modules/notificaciones/domain/entities/notificacion";
import { CampanaNotificaciones } from "@/modules/notificaciones/ui/campana-notificaciones";
import { SignOut } from "@/components/signout-button";
import { BotonCambiarPassword } from "@/modules/auth/ui/boton-cambiar-password";
import { BotonInstalarApp } from "@/shared/ui/components";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SelectorGestionPersonal } from "@/components/layout/selector-gestion-personal";
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
  acciones,
}: Readonly<{
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Bandeja que muestra la campana de esta cabecera. */
  moduloNotificaciones: ModuloNotificaciones;
  /** Página de notificaciones del módulo actual («Ver todas»). */
  rutaNotificaciones: string;
  /** Acciones propias del módulo (por ejemplo, el botón único de guía). */
  acciones?: React.ReactNode;
}>) {
  const pathName = usePathname().split("/");
  const seccionAdministracion = SECCION_POR_RUTA[pathName[1] ?? ""];

  return (
    <header className="sticky top-0 z-50 flex w-full items-center justify-between gap-2 border-b border-border bg-blue-900/100 px-2 py-2 shadow-sm sm:px-6 sm:py-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-white sm:flex-1">
        <div className="shrink-0 self-center">{children}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-sm font-semibold leading-tight text-white sm:whitespace-normal sm:text-xl">
            {title}
          </h1>
          {subtitle && <p className="hidden break-words text-sm text-white sm:block">{subtitle}</p>}
          {seccionAdministracion && (
            <Breadcrumb className="mt-1.5 hidden text-white sm:block">
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
          <SelectorGestionPersonal className="mt-1.5 hidden lg:block" />
          </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-0.5 sm:gap-2">
        {acciones}
        <BotonInstalarApp variante="oscura" />
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
