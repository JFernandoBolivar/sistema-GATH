"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { firmaEstable } from "../../domain/lib/cambios";

interface Params {
  plantillaId: string;
  /** Lo que se previsualiza (puede ser lo no guardado): `{definicion, campos_propios}`. */
  payload: Record<string, unknown> | null;
  /** Regenera sola, con pausa, cuando el payload cambia. */
  automatica: boolean;
  esperaMs?: number;
}

/** Vista previa en PDF (object URL) del borrador, a través del route handler del módulo. */
export function useVistaPrevia({ plantillaId, payload, automatica, esperaMs = 1500 }: Params) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const contador = useRef(0);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const generar = useCallback(async () => {
    const cuerpo = payloadRef.current;
    if (!cuerpo) return;
    const turno = ++contador.current;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/documentos/plantillas/${plantillaId}/vista-previa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) {
        const datos = await res.json().catch(() => null);
        throw new Error(datos?.error || "No fue posible generar la vista previa.");
      }
      const blob = await res.blob();
      if (turno !== contador.current) return; // llegó una respuesta más nueva
      const nueva = URL.createObjectURL(blob);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = nueva;
      setUrl(nueva);
    } catch (e) {
      if (turno === contador.current) setError(e instanceof Error ? e.message : "Error al generar la vista previa.");
    } finally {
      if (turno === contador.current) setCargando(false);
    }
  }, [plantillaId]);

  const firma = payload ? firmaEstable(payload) : "";
  useEffect(() => {
    if (!automatica || !firma) return;
    const t = window.setTimeout(() => void generar(), esperaMs);
    return () => window.clearTimeout(t);
  }, [automatica, firma, esperaMs, generar]);

  useEffect(
    () => () => {
      contador.current += 1;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return { url, cargando, error, generar };
}
