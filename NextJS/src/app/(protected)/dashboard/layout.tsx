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
export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  return (
    <main className="flex flex-col justify-center items-center m-auto ">
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
      <SessionProvider session={session}>{children}</SessionProvider>
    </main>
  );
}
