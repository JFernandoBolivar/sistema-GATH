"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cerrarSesionAction } from "@/modules/auth/infrastructure/actions/auth-actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOut() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await cerrarSesionAction();
    router.push("/login");
  };

  return (
    <Button
      variant={"destructive"}
      onClick={handleSignOut}
      disabled={isLoggingOut}
    >
      <LogOut />
    </Button>
  );
}
