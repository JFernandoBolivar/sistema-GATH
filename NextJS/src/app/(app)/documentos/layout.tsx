import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderLayout } from "@/components/layout/header";
import { AppSidebarPersonal } from "@/modules/personal/ui/components/app-sidebar-personal";

/** El diseñador comparte la navegación y el contexto de Gestión de Trabajadores. */
export default function DocumentosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebarPersonal />
      <SidebarInset className="min-w-0 bg-transparent">
        <HeaderLayout
          title="Gestión Administrativa de Talento Humano - GATH"
          subtitle="Diseño y generación de documentos"
          moduloNotificaciones="personal"
          rutaNotificaciones="/personal/notificaciones"
        >
          <SidebarTrigger className="size-11 scale-110 text-white" />
        </HeaderLayout>
        <main
          id="contenido-principal"
          tabIndex={-1}
          className="h-full min-h-0 w-full min-w-0 overflow-hidden"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
