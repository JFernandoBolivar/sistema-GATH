"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  cerrarSesionAction,
  extenderSesionAction,
} from "@/modules/auth/infrastructure/actions/auth-actions";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const IDLE_TIMEOUT = 15 * 60 * 1000;
export const GRACE_PERIOD = 60 * 1000;

const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];

export function AuthController() {
  // Hook incondicional (rules-of-hooks). Sin SessionProvider, next-auth lanza y
  // el error boundary de la app lo captura; no se traga el error aquí.
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? null;

  const [showAlert, setShowAlert] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(GRACE_PERIOD / 1000);

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const graceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const modalOpenRef = useRef(false);

  const clearAllTimers = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  // Las funciones que necesita el efecto de montaje viven en refs para que
  // el listener de actividad se registre UNA sola vez por sesión activa,
  // sin depender de que `session` cambie identidad entre renders (evita
  // reiniciar timers a mitad de cuenta regresiva).
  const handleLogoutRef = useRef<() => Promise<void>>(async () => {});
  const startIdleTimerRef = useRef<() => void>(() => {});
  const handleActivityRef = useRef<() => void>(() => {});

  // Las refs se actualizan en un efecto (no durante el render) en cada commit,
  // antes del efecto de montaje que las consume.
  useEffect(() => {
    handleLogoutRef.current = async () => {
      clearAllTimers();
      modalOpenRef.current = false;
      setShowAlert(false);
      await cerrarSesionAction();
      window.location.href = "/login";
    };

    startIdleTimerRef.current = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        modalOpenRef.current = true;
        setShowAlert(true);
        setSecondsLeft(GRACE_PERIOD / 1000);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
        }, 1000);
        if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
        graceTimerRef.current = setTimeout(() => {
          handleLogoutRef.current();
        }, GRACE_PERIOD);
        // El aviso aparece GRACE_PERIOD antes de cumplirse IDLE_TIMEOUT, para
        // que el cierre de sesión real ocurra exactamente a los 15 minutos
        // de inactividad continuada (no 15 min + 1 min).
      }, IDLE_TIMEOUT - GRACE_PERIOD);
    };

    handleActivityRef.current = () => {
      // Mientras el modal está abierto, la sesión solo se extiende con una
      // decisión explícita del usuario (botones), no con actividad pasiva.
      if (modalOpenRef.current) return;
      startIdleTimerRef.current();
    };
  });

  const handleLogout = () => handleLogoutRef.current();

  const handleStaySignedIn = async () => {
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    modalOpenRef.current = false;
    setShowAlert(false);
    await extenderSesionAction();
    startIdleTimerRef.current();
  };

  useEffect(() => {
    if (!sessionUserId) return;
    const onActivity = () => handleActivityRef.current();
    ACTIVITY_EVENTS.forEach((event) => document.addEventListener(event, onActivity));
    startIdleTimerRef.current();
    return () => {
      ACTIVITY_EVENTS.forEach((event) => document.removeEventListener(event, onActivity));
      clearAllTimers();
      modalOpenRef.current = false;
    };
  }, [sessionUserId]);

  if (!session) return null;

  return (
    <Dialog open={showAlert} onOpenChange={() => {}}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-[425px] border-none bg-transparent shadow-none p-0"
      >
        <DialogTitle className="sr-only">Aviso de inactividad</DialogTitle>
        <DialogDescription className="sr-only">
          Notificación de cierre de sesión por inactividad
        </DialogDescription>
        <Card className="px-6 py-10 rounded-2xl z-[99999] font-bold text-center flex flex-col gap-4 border-2 border-red-500 shadow-2xl bg-white">
          <span className="text-4xl text-red-500">⚠️</span>
          <p className="text-xl">Tu sesión está por cerrarse por inactividad.</p>
          <span className="text-sm font-normal text-muted-foreground">
            Se cerrará automáticamente en {secondsLeft} segundos.
          </span>
          <div className="flex flex-col gap-2 mt-2">
            <Button type="button" className="cursor-pointer" onClick={handleStaySignedIn}>
              Permanecer en la sesión
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={handleLogout}
            >
              Cerrar sesión
            </Button>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
