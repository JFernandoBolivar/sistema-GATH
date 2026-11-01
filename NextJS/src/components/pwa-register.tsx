"use client";

import { useEffect } from "react";

/** Registra el service worker solo en producción (Docker/local con next start). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* sin service worker la app sigue funcionando */
    });
  }, []);

  return null;
}
