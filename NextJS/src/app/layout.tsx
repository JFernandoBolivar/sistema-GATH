import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { SessionProvider } from "next-auth/react";
import "@fontsource-variable/source-sans-3";
import "driver.js/dist/driver.css";
import "@/shared/ui/guias/guias.css";
import "./globals.css";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthController } from "@/components/auth-timer";
import { TemaProvider } from "@/shared/ui/components/tema-provider";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { PwaRegister } from "@/components/pwa-register";
import { auth } from "#/auth";

export const metadata: Metadata = {
  title: "GATH - Gestión Administrativa de Talento Humano",
  description: "Portal de gestión administrativa de talento humano de CONATEL.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/favicon-32.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "GATH" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0a2a5e",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  // El servidor debe renderizar la misma clase que aplica `next-themes` antes
  // de hidratar; si no, React reporta #418 en <html>. La cookie la mantiene
  // `SincronizarTemaCookie`.
  const tema = cookieStore.get("gath-tema")?.value === "dark" ? "dark" : "light";

  return (
    <html
      lang="es-VE"
      className={`h-full w-full ${tema}`}
      suppressHydrationWarning
    >
      <body className="h-dvh overflow-hidden bg-background text-foreground antialiased">
        <TemaProvider temaInicial={tema}>
          <SessionProvider session={session}>
            <AuthController />
            <PwaRegister />
            <PwaInstallPrompt />
            <ScrollArea className="scroll-app h-dvh w-full rounded-md">{children}</ScrollArea>
          </SessionProvider>
        </TemaProvider>
      </body>
    </html>
  );
}
