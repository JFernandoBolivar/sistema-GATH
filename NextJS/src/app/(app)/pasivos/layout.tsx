import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderLayout } from "@/components/layout/header";
import { AppSidebarPasivos } from "@/modules/pasivos/ui/components/app-sidebar-pasivos";

export default function PasivosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebarPasivos />
      <SidebarInset className="min-w-0 bg-transparent">
        <HeaderLayout
          title="Gestión Administrativa de Talento Humano - GATH"
          subtitle="Gestión de Personal Pasivo (Jubilados, Pensionados y Sobrevivientes)"
          moduloNotificaciones="personal"
          rutaNotificaciones="/personal/notificaciones"
        >
          <SidebarTrigger className="text-white scale-110" />
        </HeaderLayout>
        <main id="contenido-principal" tabIndex={-1} className="w-full min-w-0 h-full">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
