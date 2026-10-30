import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderLayout } from "@/components/layout/header";
import { AppSidebarPersonal } from "@/modules/personal/ui/components/app-sidebar-personal";

/**
 * Shell de la configuración institucional: «Configuración visual» (HU 0009)
 * se alcanza desde el menú de personal y conserva la misma navegación que el
 * resto de las pantallas de RRHH.
 */
export default function ConfiguracionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebarPersonal />
      <SidebarInset className="bg-transparent">
        <HeaderLayout
          title="Gestión Administrativa de Talento Humano - GATH"
          subtitle="Gestiona y Visualiza la Información de los Trabajadores en Conatel"
          moduloNotificaciones="personal"
          rutaNotificaciones="/personal/notificaciones"
        >
          <SidebarTrigger className="text-white scale-110" />
        </HeaderLayout>
        <main className="w-full h-full overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
