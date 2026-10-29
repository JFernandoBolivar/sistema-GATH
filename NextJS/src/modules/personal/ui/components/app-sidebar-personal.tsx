"use client";

import {
  ArrowRightFromLine,
  ArrowRightLeft,
  Badge,
  BadgePlus,
  BarChart3,
  BookCheck,
  BookKey,
  BookUser,
  Boxes,
  Briefcase,
  BriefcaseBusiness,
  BriefcaseConveyorBelt,
  ChevronDown,
  ChevronRight,
  ContactRound,
  DoorOpen,
  FileChartLine,
  FileSpreadsheet,
  FolderOpenDot,
  Home,
  IdCard,
  List,
  ListCheck,
  LucideIcon,
  MoveDownRight,
  NotebookTabs,
  SignpostBig,
  User,
  UserPlus,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

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
  icon: LucideIcon;
  /** Código de permiso requerido (sin él, visible para todos). */
  permiso?: string;
};

type MenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Código de permiso requerido (sin él, visible para todos). */
  permiso?: string;
  subMenu?: SubMenuItem[];
};

const items: MenuItem[] = [
  {
    title: "Inicio",
    url: "/dashboard",
    icon: Home,
  },
  {
    
    title: "Personal Trabajador",
    url: "#",
    icon: User,
    subMenu: [
      {
        title: "Agregar Trabajador",
        url: "/personal/registrar",
        icon: UserPlus,
        permiso: "personal.crear",
      },
      {
        title: "Consultar/Actualizar",
        url: "/personal/consultar",
        icon: ListCheck,
        permiso: "personal.ver",
      },
      {
        title: "Agregar Familiar",
        url: "/familiares/registrar",
        icon: ContactRound,
        permiso: "familiares.crear",
      },
      {
        title: "Consultar Familiar",
        url: "/familiares/consultar",
        icon: BookUser,
        permiso: "familiares.ver",
      },
    ],
  },
  {
    
    title: "Ub. Administrativas",
    url: "#",
    icon: SignpostBig,
    subMenu: [
      {
        title: "Crear Ub. Administrativa",
        url: "/organizacion/crear-ubicacion",
        icon: ArrowRightFromLine,
        permiso: "organizacion.crear",
      },
      {
        title: "Crear Direcciones",
        url: "/organizacion/crear-ubicacion-administrativa-direccion",
        icon: MoveDownRight,
        permiso: "organizacion.crear",
      },
      {
        title: "Consultar Ub. Admnistrativas",
        url: "/organizacion/listado-ubicacion-administrativa",
        icon: List,
        permiso: "organizacion.ver",
      },
      {
        title: "Actualizar Ub. Admnistrativas",
        url: "/organizacion/actualizar-ubicacion",
        icon: Boxes,
        permiso: "organizacion.editar",
      },
    ],
  },
  {
    
    title: "Gestión De Codigos",
    url: "#",
    icon: Badge,
    subMenu: [
      {
        title: "Crear Nuevo Código",
        url: "/cargos/crear-codigo",
        icon: BadgePlus,
        permiso: "cargos.crear",
      },
      {
        title: "Consultar/Actualizar",
        url: "/cargos",
        icon: List,
        permiso: "cargos.ver",
      },
    ],
  },
  {
    
    title: "Movimientos",
    url: "#",
    icon: ArrowRightLeft,
    subMenu: [
      {
        title: "Asignar Cargo",
        url: "/movimientos/asignar-codigo",
        icon: BriefcaseBusiness,
        permiso: "cargos.asignar",
      },
      {
        title: "Asignar Cargo Esp",
        url: "/movimientos/asignar-codigo-especial",
        icon: Briefcase,
        permiso: "cargos.asignar",
      },
      {
        title: "Asignar Encargaduría",
        url: "/movimientos/prestamo-cargo",
        icon: ArrowRightLeft,
        permiso: "cargos.prestar",
      },
      {
        title: "Cambiar Cargo",
        url: "/movimientos/cambiar-codigo",
        icon: BriefcaseConveyorBelt,
        permiso: "movimientos.registrar_traslado",
      },
      {
        title: "Cambiar Estatus",
        url: "/movimientos/cambiar-estatus",
        icon: FileChartLine,
        permiso: "cargos.editar",
      },
      {
        title: "Egresar/Pasivo",
        url: "/movimientos/cambiar-pasivo",
        icon: BookCheck,
        permiso: "pasivos.cambiar_condicion",
      },
      {
        title: "Consultar Movimientos",
        url: "/movimientos",
        icon: ListCheck,
        permiso: "movimientos.ver",
      },
    ],
  },
  {
    
    icon: BarChart3,
    title: "Reportes",
    url: "#",
    subMenu: [
      {
        title: "Consultar Trabajador",
        url: "/reportes/empleados",
        icon: IdCard,
        permiso: "reportes.ver",
      },
      {
        title: "Consultar Familiares",
        url: "/reportes/familiares",
        icon: NotebookTabs,
        permiso: "reportes.ver",
      },
      {
        title: "Consultar Egresados",
        url: "/reportes/egresados",
        icon: DoorOpen,
        permiso: "reportes.ver",
      },
      {
        title: "Consultar Cargos",
        url: "/reportes/codigos",
        icon: BookKey,
        permiso: "reportes.ver",
      },
    ],
  },
  {
    permiso: "configuracion.editar",
    icon: FolderOpenDot,
    title: "Retroalimentación",
    url: "/retroalimentacion",
  },
  {
    
    icon: BookCheck,
    title: "Autogestión",
    url: "#",
    subMenu: [
      {
        title: "Formulario",
        url: "/autogestion",
        icon: BookCheck,
      },
      {
        title: "Respuestas Encuesta",
        url: "/autogestion/consultar",
        icon: FileSpreadsheet,
        permiso: "autogestion.censo_ver_todos",
      },
      {
        title: "Métricas",
        url: "/autogestion/metricas",
        icon: BarChart3,
        permiso: "autogestion.censo_ver_todos",
      },
    ],
  },
];

export function AppSidebarPersonal() {
  const pathname = usePathname();
  const activeSubmenuByPath = useMemo(() => {
    if (pathname?.startsWith("/movimientos")) return "Movimientos";
    if (pathname?.startsWith("/cargos")) return "Gestión De Codigos";
    if (pathname?.startsWith("/organizacion")) return "Ub. Administrativas";
    if (pathname?.startsWith("/reportes")) return "Reportes";
    if (pathname?.startsWith("/autogestion")) return "Autogestión";
    return "Personal Trabajador";
  }, [pathname]);

  const [toggledSubmenu, setToggledSubmenu] = useState<{ path: string; menu: string | null } | null>(null);

  const openSubmenu = (toggledSubmenu && toggledSubmenu.path === pathname)
    ? toggledSubmenu.menu
    : activeSubmenuByPath;

  const toggleSubmenu = (title: string) => {
    setToggledSubmenu({
      path: pathname ?? "",
      menu: openSubmenu === title ? null : title,
    });
  };
  const { data: session } = useSession();

  const isAdmin = session?.user?.role?.nombre_rol === "ADMINISTRADOR";

  const filteredItems = filtrarMenuPorPermisos(items, session?.user?.permisos);

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
                                isActive={
                                  pathname === subItem.url ||
                                  (subItem.url === "/organizacion/listado-ubicacion-administrativa" &&
                                    pathname === "/organizacion")
                                }
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
            </div>
          ) : (
            <div className="p-2 border-b-3 rounded-2xl">
              <div className="flex flex-col">
                <h1 className="font-semibold">{session.user.name}</h1>
                <h2 className="text-sm text-gray-400 font-bold">
                  C.I: {session.user.cedula}
                </h2>
              </div>
              <div className="flex flex-col">
                <h2 className="font-semibold">
                  Rol: {session.user.role.nombre_rol}
                </h2>
                <h1 className="text-sm text-gray-400 font-bold">
                  Departamento: {session.user.department?.nombre_departamento || "Sin Departamento"}
                </h1>
              </div>
            </div>
          )}
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
