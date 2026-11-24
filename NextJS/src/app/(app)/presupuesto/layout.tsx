import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { HeaderLayout } from "@/components/layout/header";
import { SidebarPresupuesto } from "@/modules/presupuesto/ui/components/sidebar-presupuesto";

export default function PresupuestoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <SidebarPresupuesto />
      <SidebarInset className="min-w-0 bg-transparent">
        <HeaderLayout
          title="Presupuesto"
          subtitle="Reserva de puesto y disponibilidad presupuestaria - CONATEL"
          moduloNotificaciones="postulacion"
          rutaNotificaciones="/presupuesto/notificaciones"
        >
          <SidebarTrigger className="text-white scale-110" />
        </HeaderLayout>
        <main id="contenido-principal" tabIndex={-1} className="w-full h-full overflow-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
