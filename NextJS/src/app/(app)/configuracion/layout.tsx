import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderLayout } from "@/components/layout/header";
import { AppSidebarSecurity } from "@/modules/identidad/ui/components/app-sidebar-security";
import {
  NOMBRE_ADMINISTRACION,
  SECCION_CONFIGURACION,
} from "@/shared/lib/administracion-sistema";

/**
 * Shell de «Administración del sistema → Configuración». La configuración
 * (parámetros e identidad visual) vive dentro del módulo de administración, con
 * la misma navegación que Usuarios y roles (D9).
 */
export default function ConfiguracionLayout({
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
          subtitle={SECCION_CONFIGURACION}
          moduloNotificaciones="seguridad"
          rutaNotificaciones="/usuarios/notificaciones"
        >
          <SidebarTrigger className="text-black-600 scale-110" />
        </HeaderLayout>
        <main className="w-full h-full overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
