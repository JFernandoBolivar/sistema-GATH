import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderLayout } from "../../../../components/layout/header";
import { AppSidebarPasivos } from "./components/layout/app-sidebar";
export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebarPasivos />
      <SidebarInset className="bg-transparent">
        <HeaderLayout
          title="Gestión de Pasivos - RAC"
          subtitle="Gestiona y Visualiza la Información de los Pasivos MPPRIJP"
        >
          <SidebarTrigger className="text-black-600   scale-110" />
        </HeaderLayout>
        <main className=" w-full h-full overflow-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
