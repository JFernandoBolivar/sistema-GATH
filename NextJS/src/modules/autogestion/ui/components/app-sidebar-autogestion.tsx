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
import { itemActivo, itemsVisibles } from "../shell/nav-autogestion";
import { ControlTamanoTexto } from "../shell/control-tamano-texto";
import { usePoliticaAutogestion } from "../solicitudes/use-politica-autogestion";
import { useAccesoMiCarnet } from "../shell/use-acceso-mi-carnet";
import { ContadorMenuNotificaciones } from "@/modules/notificaciones/ui/contador-menu-notificaciones";

/**
 * Menú de Autogestión con el mismo sidebar shadcn de los demás módulos.
 * «Inicio» lleva a /dashboard para todos los perfiles, igual que en los demás
 * módulos (antes un trabajador volvía a /autogestion, que muestra su ficha).
 */
export function AppSidebarAutogestion() {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const condicion = session?.user?.condicionTrabajador;
  const { politica } = usePoliticaAutogestion();
  const { puedeVerCarnet } = useAccesoMiCarnet();
  const visibles = itemsVisibles(permisos, condicion, {
    // Mientras carga se mantiene el comportamiento anterior (visible) para no ocultar
    // el menú por un instante; el backend vuelve a validar todo.
    autogestionHabilitada: politica?.habilitado ?? true,
    // Mi Carnet solo se muestra con la respuesta afirmativa del backend.
    miCarnetHabilitado: puedeVerCarnet,
  }).filter((item) => item.id !== "inicio");
  const inicio = "/dashboard";

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
              <SidebarMenu data-guia-id="inicio-menu-lateral">
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
                  const activo = itemActivo(item, pathname);
                  return (
                    <SidebarMenuItem key={item.id} className="mt-2">
                      <SidebarMenuButton asChild isActive={activo}>
                        <Link href={item.href} className="flex min-h-11 items-center text-base">
                          <Icono className="size-4 shrink-0" />
                          <span>{item.etiqueta}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.id === "notificaciones" ? (
                        <ContadorMenuNotificaciones modulo="autogestion" />
                      ) : null}
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
                  Rol: {session.user.role?.nombre_visible || session.user.role?.nombre_rol || "Sin Rol"}
                </h2>
              </div>
              <div className="mt-2" data-guia-id="inicio-tamano-texto">
                <ControlTamanoTexto condicionTrabajador={condicion} />
              </div>
            </div>
          )}
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
