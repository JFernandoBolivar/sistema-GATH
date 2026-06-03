import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthController } from "@/components/auth-timer";
import MarqueeTitle from "@/components/marquee-title";
export const metadata: Metadata = {
  title: "GATH - Gestion Administativa de Talento Humano",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="w-full h-full ">
      <body
        className={` antialiased  bg-no-repeat  bg-[url('/bg.jpg')] backdrop-blur-[8px] bg-cover object-center overflow-hidden  h-full`}
      >
        <MarqueeTitle text="GATH - Gestion Administativa de Talento Humano" />
        <SessionProvider>
          <AuthController />
          <ScrollArea className="h-full w-full rounded-md">
            {children}
          </ScrollArea>
        </SessionProvider>
      </body>
    </html>
  );
}
