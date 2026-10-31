import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderLayout } from "@/components/layout/header";
import { AppSidebarSecurity } from "@/modules/identidad/ui/components/app-sidebar-security";
import { NOMBRE_ADMINISTRACION, SECCION_USUARIOS } from "@/shared/lib/administracion-sistema";

export default function AdministracionSistemaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebarSecurity />
      <SidebarInset className="bg-transparent">
        <HeaderLayout
          title={NOMBRE_ADMINISTRACION}
          subtitle={SECCION_USUARIOS}
          moduloNotificaciones="seguridad"
          rutaNotificaciones="/usuarios/notificaciones"
        >
          <SidebarTrigger className="text-black-600 scale-110" />
        </HeaderLayout>
        <main className="w-full h-full overflow-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
