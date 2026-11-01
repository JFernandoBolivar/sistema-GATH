"use client";

/**
 * Menú de Gestión de Personal Pasivo con el mismo estilo del sidebar de
 * Gestión de Trabajadores. Solo enlaces de pasivos, familiares (carga
 * compartida), fe de vida y reportes de pasivos; «Inicio» va a /dashboard.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  BookCheck,
  ChevronDown,
  ChevronRight,
  BookUser,
  CalendarClock,
  ContactRound,
  HeartPulse,
  Home,
  ListCheck,
  MailX,
  UserRound,
  UserRoundPlus,
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
import { Skeleton } from "@/components/ui/skeleton";
import { filtrarMenuPorPermisos } from "@/shared/lib/permiso-menu";

type SubMenuItem = {
  title: string;
  url: string;
  icon: typeof Home;
  permiso?: string;
};

type MenuItem = {
  title: string;
  url: string;
  icon: typeof Home;
  permiso?: string;
  subMenu?: SubMenuItem[];
};

const items: MenuItem[] = [
  { title: "Inicio", url: "/dashboard", icon: Home },
  {
    permiso: "notificaciones.ver_propias",
    title: "Notificaciones",
    url: "/personal/notificaciones",
    icon: Bell,
  },
  {
    title: "Personal Pasivo",
    url: "#",
    icon: UserRound,
    subMenu: [
      {
        title: "Agregar Pasivo",
        url: "/pasivos/registrar",
        icon: UserRoundPlus,
        permiso: "pasivos.crear",
      },
      {
        title: "Consultar/Actualizar",
        url: "/pasivos/consultar",
        icon: ListCheck,
        permiso: "pasivos.ver",
      },
      {
        title: "Agregar Familiar",
        url: "/pasivos/familiares/registrar?pasivo=1",
        icon: ContactRound,
        permiso: "familiares.crear",
      },
      {
        title: "Consultar Familiar",
        url: "/pasivos/familiares/consultar?pasivo=1",
        icon: BookUser,
        permiso: "familiares.ver",
      },
    ],
  },
  {
    title: "Egreso",
    url: "#",
    icon: BookCheck,
    subMenu: [
      {
        title: "Egreso de pasivo",
        url: "/pasivos/egreso-pasivo",
        icon: BookCheck,
        permiso: "pasivos.cambiar_condicion",
      },
    ],
  },
  {
    title: "Fe de vida",
    url: "#",
    icon: HeartPulse,
    subMenu: [
      {
        title: "Bandeja de revisión",
        url: "/personal/fe-de-vida",
        icon: ListCheck,
        permiso: "fe_de_vida.revisar",
      },
      {
        title: "Procesos y prórrogas",
        url: "/personal/fe-de-vida/procesos",
        icon: CalendarClock,
        permiso: "fe_de_vida.gestionar_procesos",
      },
      {
        title: "Cobertura de pasivos",
        url: "/personal/fe-de-vida/cobertura",
        icon: MailX,
        permiso: "fe_de_vida.ver_cobertura",
      },
    ],
  },
  {
    title: "Reportes",
    url: "#",
    icon: BarChart3,
    subMenu: [
      {
        title: "Reportes de pasivos",
        url: "/reportes?tab=pasivos",
        icon: BarChart3,
        permiso: "reportes.ver",
      },
    ],
  },
];

export function AppSidebarPasivos() {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const filteredItems = filtrarMenuPorPermisos(items, session?.user?.permisos);

  const activeSubmenuByPath = useMemo(() => {
    if (pathname.startsWith("/pasivos/egreso-pasivo")) return "Egreso";
    if (pathname.startsWith("/reportes")) return "Reportes";
    if (pathname.startsWith("/personal/fe-de-vida")) return "Fe de vida";
    if (pathname.startsWith("/familiares") || pathname.startsWith("/pasivos")) {
      return "Personal Pasivo";
    }
    return "Personal Pasivo";
  }, [pathname]);

  const [toggledSubmenu, setToggledSubmenu] = useState<{ path: string; menu: string | null } | null>(null);
  const openSubmenu =
    toggledSubmenu && toggledSubmenu.path === pathname
      ? toggledSubmenu.menu
      : activeSubmenuByPath;

  const toggleSubmenu = (title: string) => {
    setToggledSubmenu({
      path: pathname,
      menu: openSubmenu === title ? null : title,
    });
  };

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
                  <SidebarMenuItem key={item.title} className="mt-5">
                    {item.subMenu ? (
                      <>
                        <SidebarMenuButton
                          onClick={() => toggleSubmenu(item.title)}
                          className="text-sm h-fit cursor-pointer"
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
                                isActive={pathname === subItem.url}
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
                      <SidebarMenuButton asChild isActive={pathname === item.url}>
                        <Link href={item.url} className="flex items-center text-sm">
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
                <h2 className="font-semibold">Rol: {session.user.role?.nombre_rol || "Sin Rol"}</h2>
              </div>
            </div>
          )}
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
