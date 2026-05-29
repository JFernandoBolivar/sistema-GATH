import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderLayout } from "../../../../components/layout/header";
import { AppSidebarSecurity } from "./components/app-sidebar";
export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebarSecurity />
      <SidebarInset className="bg-transparent">
        <HeaderLayout title="Gestión De Usuarios">
          <SidebarTrigger className="text-black-600   scale-110" />
        </HeaderLayout>
        <main className=" w-full h-full overflow-hidden">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
