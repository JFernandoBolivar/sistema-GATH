"use client";

import { useEffect, useState } from "react";

/**
 * Hook para detectar el estado de conexión a internet (online / offline).
 * Permite advertir oportunamente al pasivo sobre fallas de red y asegurar que sus datos están a salvo.
 */
export function useConectividad() {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return true;
    }
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleOnline() {
      setOnline(true);
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { online };
}
