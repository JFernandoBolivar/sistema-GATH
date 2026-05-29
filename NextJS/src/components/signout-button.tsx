"use client";

import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { logoutAction } from "#/actions/auth-actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOut() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    await logoutAction();
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
