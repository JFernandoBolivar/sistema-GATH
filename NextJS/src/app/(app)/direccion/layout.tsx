import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { HeaderLayout } from "@/components/layout/header";
import { SidebarDireccion } from "@/modules/direccion/ui/components/sidebar-direccion";

export default function DireccionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <SidebarDireccion />
      <SidebarInset className="min-w-0 bg-transparent">
        <HeaderLayout
          title="Dirección General"
          subtitle="Decisión sobre los ingresos de personal - CONATEL"
          moduloNotificaciones="postulacion"
          rutaNotificaciones="/direccion/notificaciones"
        >
          <SidebarTrigger className="text-white scale-110" />
        </HeaderLayout>
        <main id="contenido-principal" tabIndex={-1} className="w-full h-full overflow-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
