import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderLayout } from "@/components/layout/header";
import { AppSidebarPersonal } from "@/modules/personal/ui/components/app-sidebar-personal";

export default function CargosLayout({
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
