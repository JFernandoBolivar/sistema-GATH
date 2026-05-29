import { SessionProvider } from "next-auth/react";
import Dashboard from "@/app/(protected)/dashboard/page";

export default function Administrator() {
  return (
    <SessionProvider>
      <Dashboard />
    </SessionProvider>
  );
}
