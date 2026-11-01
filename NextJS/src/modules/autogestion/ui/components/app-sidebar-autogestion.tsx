"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Home } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { esPerfilAutogestion } from "@/shared/lib/perfil-acceso";
import { itemActivo, itemsVisibles } from "../shell/nav-autogestion";
import { ControlTamanoTexto } from "../shell/control-tamano-texto";

/**
 * Menú de Autogestión con el mismo sidebar shadcn de los demás módulos.
 * «Inicio» lleva a /dashboard; un perfil que solo tiene Autogestión
 * (derivado de permisos con `esPerfilAutogestion`) vuelve a /autogestion.
 */
export function AppSidebarAutogestion() {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const condicion = session?.user?.condicionTrabajador;
  const visibles = itemsVisibles(permisos, condicion).filter((item) => item.id !== "inicio");
  const inicio = esPerfilAutogestion(permisos) ? "/autogestion" : "/dashboard";

  return (
    <Sidebar>
      <SidebarContent className="flex flex-col justify-between">
        <SidebarGroup>
          <SidebarGroupLabel className="w-full h-fit">
            <Image
              src="/logoOAC.png"
              alt="Logo CONATEL"
              width={150}
              height={98}
              className="h-full w-full object-cover rounded-2xl"
            />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {!session ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="w-full p-2 bg-muted animate-pulse mt-3" />
                ))}
              </div>
            ) : (
              <SidebarMenu>
                <SidebarMenuItem className="mt-2">
                  <SidebarMenuButton asChild isActive={pathname === inicio}>
                    <Link href={inicio} className="flex min-h-11 items-center text-base">
                      <Home className="size-4" />
                      <span>Inicio</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {visibles.map((item) => {
                  const Icono = item.icono;
                  const activo = itemActivo(item, pathname) && !(item.id === "inicio" && inicio === "/autogestion");
                  return (
                    <SidebarMenuItem key={item.id} className="mt-2">
                      <SidebarMenuButton asChild isActive={activo}>
                        <Link href={item.href} className="flex min-h-11 items-center text-base">
                          <Icono className="size-4 shrink-0" />
                          <span>{item.etiqueta}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarFooter>
          {!session ? (
            <div className="p-2 border-b-3 rounded-2xl flex flex-col gap-2">
              <Skeleton className="w-full p-2 bg-muted animate-pulse" />
              <Skeleton className="w-full p-2 bg-muted animate-pulse" />
            </div>
          ) : (
            <div className="p-2 border-b-3 rounded-2xl">
              <div className="flex flex-col">
                <h1 className="font-semibold">{session.user.name}</h1>
                <h2 className="text-sm text-muted-foreground font-bold">
                  C.I: {session.user.cedula}
                </h2>
              </div>
              <div className="flex flex-col">
                <h2 className="font-semibold">
                  Rol: {session.user.role?.nombre_rol || "Sin Rol"}
                </h2>
              </div>
              <div className="mt-2">
                <ControlTamanoTexto condicionTrabajador={condicion} />
              </div>
            </div>
          )}
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
