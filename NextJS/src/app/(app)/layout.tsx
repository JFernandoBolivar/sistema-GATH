"use server";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "next-auth/react";
import {
  CheckCheck,
  CircleX,
  Info,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import { auth } from "#/auth";
import { AppNav } from "./app-nav";

/**
 * Layout del grupo de rutas nuevas de la arquitectura Onion (F8: reemplaza a
 * `dashboard/migracion/`). Replica el shell de `(protected)/dashboard/layout.tsx`
 * (SessionProvider + Toaster) y agrega la navegación entre módulos.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <main className="flex min-h-svh flex-col">
      <Toaster
        closeButton
        position="top-right"
        visibleToasts={2}
        icons={{
          success: <CheckCheck />,
          info: <Info />,
          warning: <ShieldAlert />,
          error: <CircleX />,
          loading: <LoaderCircle />,
        }}
        toastOptions={{
          classNames: {
            success: "!bg-lime-600",
            error: "!bg-red-600",
            warning: "!bg-yellow-600",
            loading: "!bg-cyan-500",
          },
          style: {
            color: "white",
            border: "none",
            boxShadow: "0 0 45px #0002",
            position: "sticky",
            bottom: "0",
            right: "0",
          },
        }}
      />
      <SessionProvider session={session}>
        <div className="flex min-h-svh flex-1">
          <AppNav />
          <div className="flex-1">{children}</div>
        </div>
      </SessionProvider>
    </main>
  );
}
