import type { ReactNode } from "react";

import { HeaderLayout } from "@/components/layout/header";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebarAutogestion } from "../components/app-sidebar-autogestion";
import { BotonGuiaAutogestion } from "../guias/boton-guia-autogestion";
import { ProveedorGuiaAutogestion } from "../guias/contexto-guia";

/** Autogestión usa el mismo marco que Administración, Personal y Carnetización. */
export function AutogestionShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ProveedorGuiaAutogestion>
      <SidebarProvider>
        <AppSidebarAutogestion />
        <SidebarInset className="min-w-0 bg-transparent">
          <HeaderLayout
            title="Autogestión de Personal"
            subtitle="Mis datos, solicitudes y fe de vida"
            moduloNotificaciones="autogestion"
            rutaNotificaciones="/autogestion/notificaciones"
            acciones={<BotonGuiaAutogestion />}
          >
            <SidebarTrigger className="text-white scale-110" />
          </HeaderLayout>
          <main id="contenido-principal" tabIndex={-1} className="w-full h-full p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </ProveedorGuiaAutogestion>
  );
}
