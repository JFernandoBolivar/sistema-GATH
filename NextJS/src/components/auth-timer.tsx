"use client";
import { useEffect, useCallback, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { logoutAction } from "#/actions/auth-actions";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function AuthController() {
  const router = useRouter();
  const { data: session } = useSession();
  const [showAlert, setShowAlert] = useState(false);

  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const TOTAL_TIME = 10 * 60 * 1000; // 5m
  const WARNING_TIME = 5 * 60 * 1000; // 5m antes

  const handleLogout = useCallback(async () => {
    await logoutAction();
    router.push("/login");
  }, [router]);

  useEffect(() => {
    if (!session) return;
    const resetTimer = () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      warningTimerRef.current = setTimeout(() => {
        setShowAlert(true);
      }, TOTAL_TIME - WARNING_TIME);
      logoutTimerRef.current = setTimeout(() => {
        handleLogout();
      }, TOTAL_TIME);
    };
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
    ];
    events.forEach((event) => document.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      events.forEach((event) =>
        document.removeEventListener(event, resetTimer),
      );
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [session, handleLogout, TOTAL_TIME, WARNING_TIME]);

  if (!session) return null;

  return (
    <Dialog open={showAlert} onOpenChange={setShowAlert}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        className="sm:max-w-[425px] border-none bg-transparent shadow-none p-0"
      >
        <Card className="px-6 py-10 rounded-2xl z-[99999] font-bold text-center flex flex-col gap-4 border-2 border-red-500 shadow-2xl bg-white">
          <span className="text-4xl text-red-500">⚠️</span>
          <p className="text-xl">Tu sesión expirará pronto por inactividad.</p>
          <span className="text-sm font-normal text-muted-foreground">
            Mueve el mouse o presiona una tecla para continuar
          </span>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
