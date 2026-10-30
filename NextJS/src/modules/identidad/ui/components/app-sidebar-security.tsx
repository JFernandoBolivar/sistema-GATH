"use client";
import {
  Bell,
  BadgePlus,
  BookCheck,
  ChevronDown,
  ChevronRight,
  Home,
  IdCard,
  List,
  ListCheck,
  LucideIcon,
  PersonStanding,
  User,
} from "lucide-react";

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
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { filtrarMenuPorPermisos } from "@/shared/lib/permiso-menu";

type MenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Código de permiso requerido (sin él, visible para todos). */
  permiso?: string;
  subMenu?: SubMenuItem[];
};

type SubMenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Código de permiso requerido (sin él, visible para todos). */
  permiso?: string;
};

const items: MenuItem[] = [
  {
    title: "Inicio",
    url: "/inicio",
    icon: Home,
  },
  {
    permiso: "notificaciones.ver_propias",
    title: "Notificaciones",
    url: "/usuarios/notificaciones",
    icon: Bell,
  },
  {
    
    title: "Gestionar Usuarios",
    url: "#",
    icon: User,
    subMenu: [
      {
        title: "Registrar",
        url: "/usuarios/registrar",
        icon: PersonStanding,
        permiso: "identidad.crear_usuarios",
      },
      {
        title: "Modificar",
        url: "/usuarios/modificar",
        icon: ListCheck,
        permiso: "identidad.editar_usuarios",
      },
    ],
  },
  {
    
    title: "Gestionar Roles",
    url: "#",
    icon: IdCard,
    subMenu: [
      {
        title: "Registrar",
        url: "/usuarios/roles/registrar",
        icon: BadgePlus,
        permiso: "identidad.crear_roles",
      },
      {
        title: "Consultar",
        url: "/usuarios/roles",
        icon: List,
        permiso: "identidad.editar_roles",
      },
    ],
  },
  {
    icon: BookCheck,
    title: "Autogestión",
    url: "/autogestion",
  },
];

export function AppSidebarSecurity() {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const toggleSubmenu = (title: string) => {
    setOpenSubmenu(openSubmenu === title ? null : title);
  };
  const { data: session } = useSession();

  const filteredItems = filtrarMenuPorPermisos(items, session?.user?.permisos);

  return (
    <Sidebar>
      <SidebarContent className="flex flex-col justify-between">
        <SidebarGroup>
          <SidebarGroupLabel className="w-full h-fit">
            <Image
              src="/logoOAC.png"
              alt="Logo 1"
              width={150}
              height={98}
              className="h-full w-full object-cover rounded-2xl"
            />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {!session ? (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <SidebarMenuItem key={index}>
                    <Skeleton className="w-full p-2 bg-gray-200 animate-pulse mt-3" />
                  </SidebarMenuItem>
                ))}
              </>
            ) : (
              <SidebarMenu>
                {filteredItems.map((item) => (
                  <SidebarMenuItem key={item.title} className={"mt-5"}>
                    {item.subMenu ? (
                      <>
                        <SidebarMenuButton
                          onClick={() => toggleSubmenu(item.title)}
                          className="text-sm h-fit"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center">
                              <item.icon className="h-[16px]" />
                              <span className="ml-2 text-sm">{item.title}</span>
                            </div>
                            {openSubmenu === item.title ? (
                              <ChevronDown size={20} />
                            ) : (
                              <ChevronRight size={20} />
                            )}
                          </div>
                        </SidebarMenuButton>
                        {openSubmenu === item.title && (
                          <div className="pl-8 py-1 gap-1 text-sm">
                            {item.subMenu.map((subItem) => (
                              <SidebarMenuButton
                                key={subItem.title}
                                asChild
                                className="mt-2 text-sm"
                              >
                                <Link href={subItem.url} className="text-sm">
                                  <subItem.icon className="h-[32px]" />
                                  {subItem.title}
                                </Link>
                              </SidebarMenuButton>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <SidebarMenuButton asChild>
                        <Link
                          href={item.url}
                          className="flex items-center text-sm"
                        >
                          <item.icon className="h-[32px]" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarFooter>
          {!session ? (
            <div className="p-2 border-b-3 rounded-2xl flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <Skeleton className="w-full p-2 bg-gray-200 animate-pulse" />
                <Skeleton className="w-full p-2 bg-gray-200 animate-pulse" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="w-full p-2 bg-gray-200 animate-pulse" />
                <Skeleton className="w-full p-2 bg-gray-200 animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="p-2 border-b-3 rounded-2xl ">
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
                <h1 className="text-sm text-muted-foreground font-bold">
                  Departamento:{" "}
                  {session.user.department?.nombre_departamento ||
                    "Sin Departamento"}
                </h1>
              </div>
            </div>
          )}
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
