import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { HeaderLayout } from "@/components/layout/header";
import { AppSidebarCaptacion } from "@/modules/captacion/ui/components/app-sidebar-captacion";

export default function CaptacionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebarCaptacion />
      <SidebarInset className="min-w-0 bg-transparent">
        <HeaderLayout
          title="Captación de Personal"
          subtitle="Postulantes y expedientes de ingreso - CONATEL"
          moduloNotificaciones="postulacion"
          rutaNotificaciones="/captacion/notificaciones"
        >
          <SidebarTrigger className="text-white scale-110" />
        </HeaderLayout>
        <main id="contenido-principal" tabIndex={-1} className="w-full h-full overflow-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
