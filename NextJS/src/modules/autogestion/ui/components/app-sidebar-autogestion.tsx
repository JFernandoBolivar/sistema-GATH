"use client";

import Link from "next/link";
import {
  BarChart3,
  BookCheck,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Home,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";
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

export function AppSidebarAutogestion() {
  const { data: session } = useSession();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>("Autogestión");

  const toggleSubmenu = (title: string) => {
    setOpenSubmenu(openSubmenu === title ? null : title);
  };

  const isRacAdmin =
    session?.user?.role?.nombre_rol === "ADMINISTRADOR" ||
    (session?.user?.role?.nombre_rol === "PRESUPUESTO" &&
      session?.user?.department?.nombre_departamento === "RAC");

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
            <SidebarMenu>
              <SidebarMenuItem className="mt-2">
                <SidebarMenuButton asChild>
                  <Link href="/dashboard" className="flex items-center text-sm">
                    <Home className="size-4" />
                    <span>Inicio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isRacAdmin && (
                <SidebarMenuItem className="mt-5">
                  <SidebarMenuButton
                    onClick={() => toggleSubmenu("Autogestión")}
                    className="text-sm h-fit cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center">
                        <BookCheck className="h-[16px]" />
                        <span className="ml-2 text-sm">Autogestión</span>
                      </div>
                      {openSubmenu === "Autogestión" ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </div>
                  </SidebarMenuButton>
                  {openSubmenu === "Autogestión" && (
                    <div className="pl-8 py-1 gap-1 text-sm">
                      <SidebarMenuButton asChild className="mt-2 text-sm">
                        <Link href="/autogestion" className="text-sm">
                          <BookCheck className="h-[32px]" />
                          Formulario
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuButton asChild className="mt-2 text-sm">
                        <Link
                          href="/autogestion/consultar"
                          className="text-sm"
                        >
                          <FileSpreadsheet className="h-[32px]" />
                          Respuestas Encuesta
                        </Link>
                      </SidebarMenuButton>
                      <SidebarMenuButton asChild className="mt-2 text-sm">
                        <Link
                          href="/autogestion/metricas"
                          className="text-sm"
                        >
                          <BarChart3 className="h-[32px]" />
                          Métricas
                        </Link>
                      </SidebarMenuButton>
                    </div>
                  )}
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarFooter>
          {!session ? (
            <div className="p-2 border-b-3 rounded-2xl flex flex-col gap-2">
              <Skeleton className="w-full p-2 bg-gray-200 animate-pulse" />
              <Skeleton className="w-full p-2 bg-gray-200 animate-pulse" />
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
                  Rol: {session.user.role?.nombre_rol || "Sin Rol"}
                </h2>
                <h1 className="text-sm text-gray-400 font-bold">
                  Departamento:{" "}
                  {session.user.department?.nombre_departamento || "Sin Departamento"}
                </h1>
              </div>
            </div>
          )}
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
