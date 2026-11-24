"use client";

import { Stamp } from "lucide-react";
import { AppSidebarArea } from "@/modules/presupuesto/ui/components/app-sidebar-area";

export function SidebarDireccion() {
  return (
    <AppSidebarArea
      rutaAvisos="/direccion/notificaciones"
      bandeja={{ title: "Ingresos", url: "/direccion/ingresos", icon: Stamp, permiso: "postulacion.ver_ingresos" }}
    />
  );
}
