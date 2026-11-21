"use client";

import { Bell, ClipboardList, Home, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
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
import { filtrarMenuPorPermisos } from "@/shared/lib/permiso-menu";
import {
  ContadorMenuNotificaciones,
  moduloDeRutaNotificaciones,
} from "@/modules/notificaciones/ui/contador-menu-notificaciones";

interface ItemMenu {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Código de permiso requerido (sin él, visible para todos). */
  permiso?: string;
}

const ITEMS: ItemMenu[] = [
  { title: "Inicio", url: "/dashboard", icon: Home },
  { title: "Notificaciones", url: "/captacion/notificaciones", icon: Bell, permiso: "notificaciones.ver_propias" },
  { title: "Expedientes", url: "/captacion/expedientes", icon: ClipboardList, permiso: "postulacion.ver_bandeja" },
];

export function AppSidebarCaptacion() {
  const { data: session } = useSession();
  const items = filtrarMenuPorPermisos(ITEMS, session?.user?.permisos);

  return (
    <Sidebar>
      <SidebarContent className="flex flex-col justify-between">
        <SidebarGroup>
          <SidebarGroupLabel className="w-full h-fit">
            <Image src="/logoOAC.png" alt="Logo CONATEL" width={150} height={98} className="h-full w-full object-cover rounded-2xl" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {!session ? (
              Array.from({ length: 3 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <Skeleton className="w-full p-2 bg-gray-200 animate-pulse mt-3" />
                </SidebarMenuItem>
              ))
            ) : (
              <SidebarMenu>
                {items.map((item) => {
                  const modulo = moduloDeRutaNotificaciones(item.url);
                  return (
                    <SidebarMenuItem key={item.title} className="mt-5">
                      <SidebarMenuButton asChild>
                        <Link href={item.url} className="flex items-center text-sm">
                          <item.icon className="h-[32px]" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {modulo ? <ContadorMenuNotificaciones modulo={modulo} /> : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarFooter>
          {session ? (
            <div className="p-2 border-b-3 rounded-2xl">
              <h1 className="font-semibold">{session.user.name}</h1>
              <h2 className="text-sm text-muted-foreground font-bold">C.I: {session.user.cedula}</h2>
              <h2 className="font-semibold">Rol: {session.user.role?.nombre_visible || session.user.role?.nombre_rol || "Sin Rol"}</h2>
            </div>
          ) : null}
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
