"use client";

import { useEffect, useState } from "react";

/** Devuelve `valor` tras `retardoMs` sin cambios: evita una petición al servidor por cada tecla. */
export function useBusquedaDiferida(valor: string, retardoMs = 350): string {
  const [diferido, setDiferido] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setDiferido(valor), retardoMs);
    return () => clearTimeout(id);
  }, [valor, retardoMs]);
  return diferido;
}
