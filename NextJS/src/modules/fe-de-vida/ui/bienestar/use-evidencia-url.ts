"use client";

import { useCallback, useEffect, useState } from "react";
import { obtenerEvidenciaAction } from "../../infrastructure/actions/fe-de-vida-actions";

export type EstadoEvidencia =
  | { estado: "cargando" }
  | { estado: "lista"; url: string }
  | { estado: "error"; mensaje: string };

const MENSAJE_ERROR = "No se pudo cargar la foto. Verifique que tiene permiso para verla.";

function base64ABlob(base64: string, mime: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

/**
 * Foto con la cédula como object URL: la Server Action pide los bytes a Django con la sesión del servidor
 * (el navegador nunca ve el token ni el almacén) y la URL se revoca al desmontar o al reintentar.
 */
export function useEvidenciaUrl(solicitudId: string) {
  const [estado, setEstado] = useState<EstadoEvidencia>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;
    let objeto: string | null = null;
    obtenerEvidenciaAction(solicitudId)
      .then((res) => {
        if (!activo) return;
        if (!res.ok) {
          setEstado({ estado: "error", mensaje: res.mensaje || MENSAJE_ERROR });
          return;
        }
        objeto = URL.createObjectURL(base64ABlob(res.datos.base64, res.datos.mime));
        setEstado({ estado: "lista", url: objeto });
      })
      .catch(() => {
        if (activo) setEstado({ estado: "error", mensaje: MENSAJE_ERROR });
      });
    return () => {
      activo = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [solicitudId, intento]);

  const reintentar = useCallback(() => {
    setEstado({ estado: "cargando" });
    setIntento((n) => n + 1);
  }, []);
  const falloLaImagen = useCallback(
    () => setEstado({ estado: "error", mensaje: "La imagen recibida no se pudo mostrar." }),
    [],
  );

  return { estado, reintentar, falloLaImagen };
}
