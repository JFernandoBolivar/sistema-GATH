import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthController } from "@/components/auth-timer";
import MarqueeTitle from "@/components/marquee-title";
import { auth } from "#/auth";

export const metadata: Metadata = {
  title: "GATH - Gestion Administativa de Talento Humano",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className="w-full h-full ">
      <body
        className={` antialiased  bg-no-repeat  bg-[url('/bg.jpg')] backdrop-blur-[8px] bg-cover object-center overflow-hidden  h-full`}
      >
        <MarqueeTitle text="GATH - Gestion Administativa de Talento Humano" />
        <SessionProvider session={session}>
          <AuthController />
          <ScrollArea className="h-full w-full rounded-md">
            {children}
          </ScrollArea>
        </SessionProvider>
      </body>
    </html>
  );
}
