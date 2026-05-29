import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderLayout } from "../../../../components/layout/header";
import { AppSidebarCarnetizacion } from "./components/app-sidebar";

export default function CarnetizacionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebarCarnetizacion />
      <SidebarInset className="bg-transparent">
        <HeaderLayout
          title="Sistema de Carnetización"
          subtitle="Generación y Gestión de Carnets del Personal - CONATEL"
        >
          <SidebarTrigger className="text-black-600 scale-110" />
        </HeaderLayout>
        <main className="w-full h-full overflow-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
