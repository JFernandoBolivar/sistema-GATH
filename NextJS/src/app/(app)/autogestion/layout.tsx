import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { HeaderLayout } from "@/components/layout/header";
import { AppSidebarAutogestion } from "@/modules/autogestion/ui/components/app-sidebar-autogestion";

export default function AutogestionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebarAutogestion />
      <SidebarInset className="bg-transparent">
        <HeaderLayout
          title="Gestión Administrativa de Talento Humano - GATH"
          subtitle="Autogestión de Personal"
        >
          <SidebarTrigger className="text-white scale-110" />
        </HeaderLayout>
        <main className="w-full h-full overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
