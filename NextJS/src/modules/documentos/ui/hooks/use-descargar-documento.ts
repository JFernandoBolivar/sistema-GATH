"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { guardarArchivo } from "@/shared/lib/exportaciones-asincronas";
import { descargarDocumentoGeneradoAction } from "../../infrastructure/actions/documentos-actions";

/** Obtiene el PDF por streaming desde el proxy mismo origen y lo guarda como Blob. */
export function useDescargarDocumento() {
  const [descargando, setDescargando] = useState<string | null>(null);

  const descargar = useCallback(async (id: string, nombre: string): Promise<boolean> => {
    setDescargando(id);
    try {
      const r = await descargarDocumentoGeneradoAction(id, nombre);
      if (!r.success) {
        toast.error(r.error);
        return false;
      }
      const respuesta = await fetch(r.data.url, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => null);
        throw new Error(datos?.error || "No se pudo descargar el documento.");
      }
      guardarArchivo(await respuesta.blob(), r.data.nombre);
      return true;
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "No se pudo descargar el documento.");
      return false;
    } finally {
      setDescargando(null);
    }
  }, []);

  return { descargando, descargar };
}
