"use client";

import { useEffect, useState } from "react";

/** Reloj de la cuenta regresiva: se actualiza cada `cadaMs` (por defecto 30 s; no es un cronómetro decorativo). */
export function useAhora(cadaMs = 30_000): Date {
  const [ahora, setAhora] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), cadaMs);
    return () => clearInterval(id);
  }, [cadaMs]);
  return ahora;
}
