"use client";

import { Wallet } from "lucide-react";
import { AppSidebarArea } from "./app-sidebar-area";

export function SidebarPresupuesto() {
  return (
    <AppSidebarArea
      rutaAvisos="/presupuesto/notificaciones"
      bandeja={{ title: "Solicitudes", url: "/presupuesto/solicitudes", icon: Wallet, permiso: "postulacion.ver_solicitudes" }}
    />
  );
}
