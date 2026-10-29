import type { Metadata, Viewport } from "next";
import { SessionProvider } from "next-auth/react";
import "@fontsource-variable/source-sans-3";
import "./globals.css";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthController } from "@/components/auth-timer";
import { TemaProvider } from "@/shared/ui/components/tema-provider";
import { auth } from "#/auth";

export const metadata: Metadata = {
  title: "GATH - Gestión Administrativa de Talento Humano",
  description: "Portal de gestión administrativa de talento humano de CONATEL.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a2a5e",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="es-VE" className="h-full w-full" suppressHydrationWarning>
      <body className="h-full overflow-hidden bg-background text-foreground antialiased">
        <TemaProvider>
          <SessionProvider session={session}>
            <AuthController />
            <ScrollArea className="h-full w-full rounded-md">{children}</ScrollArea>
          </SessionProvider>
        </TemaProvider>
      </body>
    </html>
  );
}
