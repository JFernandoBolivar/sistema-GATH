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
import { useEffect, useState } from "react";

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

type Permission = {
  roleAccept: string[];
  departmentAccept: string[];
};

type SubMenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: Permission;
};

type MenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission?: Permission;
  subMenu?: SubMenuItem[];
};

const items: MenuItem[] = [
  {
    title: "Inicio",
    url: "/dashboard",
    icon: Home,
  },
  {
    permission: {
      roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO", "BIENSTAR SOCIAL", "RECEPCIONISTA"],
      departmentAccept: ["RAC"],
    },
    title: "Personal Trabajador",
    url: "#",
    icon: User,
    subMenu: [
      {
        title: "Agregar Trabajador",
        url: "/personal/registrar",
        icon: UserPlus,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Consultar/Actualizar",
        url: "/personal/consultar",
        icon: ListCheck,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO", "BIENSTAR SOCIAL", "RECEPCIONISTA"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Agregar Familiar",
        url: "/familiares",
        icon: ContactRound,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR", "BIENSTAR SOCIAL"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Consultar Familiar",
        url: "/familiares",
        icon: BookUser,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR", "BIENSTAR SOCIAL", "RECEPCIONISTA"],
          departmentAccept: ["RAC"],
        },
      },
    ],
  },
  {
    permission: {
      roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO"],
      departmentAccept: ["RAC"],
    },
    title: "Ub. Administrativas",
    url: "#",
    icon: SignpostBig,
    subMenu: [
      {
        title: "Crear Ub. Administrativa",
        url: "/organizacion/dependencias",
        icon: ArrowRightFromLine,
        permission: {
          roleAccept: ["ADMINISTRADOR", "PRESUPUESTO"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Crear Direcciones",
        url: "/organizacion/direcciones-linea",
        icon: MoveDownRight,
        permission: {
          roleAccept: ["ADMINISTRADOR", "PRESUPUESTO"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Consultar Ub. Admnistrativas",
        url: "/organizacion",
        icon: List,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Actualizar Ub. Admnistrativas",
        url: "/organizacion/coordinaciones",
        icon: Boxes,
        permission: {
          roleAccept: ["ADMINISTRADOR", "PRESUPUESTO"],
          departmentAccept: ["RAC"],
        },
      },
    ],
  },
  {
    permission: {
      roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO"],
      departmentAccept: ["RAC"],
    },
    title: "Gestión De Codigos",
    url: "#",
    icon: Badge,
    subMenu: [
      {
        title: "Crear Nuevo Código",
        url: "/cargos/crear-codigo",
        icon: BadgePlus,
        permission: {
          roleAccept: ["ADMINISTRADOR", "PRESUPUESTO"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Consultar/Actualizar",
        url: "/cargos",
        icon: List,
        permission: {
          roleAccept: ["ADMINISTRADOR", "PRESUPUESTO"],
          departmentAccept: ["RAC"],
        },
      },
    ],
  },
  {
    permission: {
      roleAccept: ["ANALISTA", "ADMINISTRADOR", "BIENSTAR SOCIAL"],
      departmentAccept: ["RAC"],
    },
    title: "Movimientos",
    url: "#",
    icon: ArrowRightLeft,
    subMenu: [
      {
        title: "Asignar Cargo",
        url: "/movimientos",
        icon: BriefcaseBusiness,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Asignar Cargo Esp",
        url: "/movimientos",
        icon: Briefcase,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Asignar Encargaduría",
        url: "/movimientos",
        icon: ArrowRightLeft,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Cambiar Cargo",
        url: "/movimientos",
        icon: BriefcaseConveyorBelt,
        permission: {
          roleAccept: ["ADMINISTRADOR"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Cambiar Estatus",
        url: "/movimientos",
        icon: FileChartLine,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Egresar/Pasivo",
        url: "/movimientos",
        icon: BookCheck,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Consultar Movimientos",
        url: "/movimientos",
        icon: ListCheck,
        permission: {
          roleAccept: ["ADMINISTRADOR", "BIENSTAR SOCIAL"],
          departmentAccept: ["RAC"],
        },
      },
    ],
  },
  {
    permission: {
      roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO"],
      departmentAccept: ["RAC"],
    },
    icon: BarChart3,
    title: "Reportes",
    url: "#",
    subMenu: [
      {
        title: "Consultar Trabajador",
        url: "/reportes",
        icon: IdCard,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Consultar Familiares",
        url: "/reportes",
        icon: NotebookTabs,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Consultar Egresados",
        url: "/reportes",
        icon: DoorOpen,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Consultar Cargos",
        url: "/reportes",
        icon: BookKey,
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO"],
          departmentAccept: ["RAC"],
        },
      },
    ],
  },
  {
    permission: {
      roleAccept: ["ADMINISTRADOR"],
      departmentAccept: ["RAC"],
    },
    icon: FolderOpenDot,
    title: "Retroalimentación",
    url: "/reportes",
  },
  {
    permission: {
      roleAccept: ["ANALISTA", "ADMINISTRADOR", "PRESUPUESTO", "BIENSTAR SOCIAL"],
      departmentAccept: ["RAC"],
    },
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
        permission: {
          roleAccept: ["ANALISTA", "ADMINISTRADOR", "BIENSTAR SOCIAL"],
          departmentAccept: ["RAC"],
        },
      },
      {
        title: "Métricas",
        url: "/autogestion/metricas",
        icon: BarChart3,
        permission: {
          roleAccept: ["ADMINISTRADOR"],
          departmentAccept: ["RAC"],
        },
      },
    ],
  },
];

export function AppSidebarPersonal() {
  const pathname = usePathname();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(() => {
    if (pathname?.startsWith("/movimientos")) return "Movimientos";
    if (pathname?.startsWith("/cargos")) return "Gestión De Codigos";
    if (pathname?.startsWith("/organizacion")) return "Ub. Administrativas";
    if (pathname?.startsWith("/reportes")) return "Reportes";
    if (pathname?.startsWith("/autogestion")) return "Autogestión";
    return "Personal Trabajador";
  });

  useEffect(() => {
    if (pathname?.startsWith("/movimientos")) {
      setOpenSubmenu("Movimientos");
    } else if (pathname?.startsWith("/cargos")) {
      setOpenSubmenu("Gestión De Codigos");
    } else if (pathname?.startsWith("/organizacion")) {
      setOpenSubmenu("Ub. Administrativas");
    } else if (pathname?.startsWith("/reportes")) {
      setOpenSubmenu("Reportes");
    } else if (pathname?.startsWith("/autogestion")) {
      setOpenSubmenu("Autogestión");
    } else if (pathname?.startsWith("/personal") || pathname?.startsWith("/familiares")) {
      setOpenSubmenu("Personal Trabajador");
    }
  }, [pathname]);

  const toggleSubmenu = (title: string) => {
    setOpenSubmenu(openSubmenu === title ? null : title);
  };
  const { data: session } = useSession();

  const isAdmin = session?.user?.role?.nombre_rol === "ADMINISTRADOR";

  const checkPermission = (item: MenuItem | SubMenuItem): boolean => {
    if (isAdmin) return true;
    if (!item.permission) return true;

    const hasRolePermission = item.permission.roleAccept.includes(
      session?.user?.role?.nombre_rol || "",
    );

    const hasDepartmentPermission = item.permission.departmentAccept.includes(
      session?.user?.department?.nombre_departamento || "",
    );

    return hasRolePermission && hasDepartmentPermission;
  };

  const filteredItems = items
    .filter((item) => {
      if (!checkPermission(item)) return false;
      if (!item.subMenu) return true;
      const filteredSubMenu = item.subMenu.filter((subItem) => {
        return checkPermission(subItem);
      });
      return filteredSubMenu.length > 0;
    })
    .map((item) => {
      if (item.subMenu) {
        const filteredSubMenu = item.subMenu.filter((subItem) =>
          checkPermission(subItem),
        );
        return {
          ...item,
          subMenu: filteredSubMenu,
        };
      }
      return item;
    });

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
