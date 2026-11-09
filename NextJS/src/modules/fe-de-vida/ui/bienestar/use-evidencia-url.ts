"use client";

import { useCallback, useEffect, useState } from "react";
import { obtenerEvidenciaAction } from "../../infrastructure/actions/fe-de-vida-actions";

export type EstadoEvidencia =
  | { estado: "cargando" }
  | { estado: "lista"; url: string }
  | { estado: "sin_foto"; mensaje: string }
  | { estado: "error"; mensaje: string };

const MENSAJE_ERROR = "No se pudo cargar la foto. Verifique que tiene permiso para verla.";
const MENSAJE_SIN_FOTO = "El pasivo aún no ha cargado la foto.";

function esMensajeSinFoto(mensaje?: string | null): boolean {
  if (!mensaje) return false;
  const m = mensaje.toLowerCase();
  return (
    m.includes("no tiene foto") ||
    m.includes("sin foto") ||
    m.includes("no tiene evidencia") ||
    m.includes("foto vigente")
  );
}

function base64ABlob(base64: string, mime: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

/**
 * Foto con la cédula como object URL: la Server Action pide los bytes a Django con la sesión del servidor
 * (el navegador nunca ve el token ni el almacén) y la URL se revoca al desmontar o al reintentar.
 */
export function useEvidenciaUrl(
  solicitudId: string,
  opciones?: { habilitado?: boolean; estadoSolicitud?: string; tieneEvidencia?: boolean },
) {
  const sinFotoInicial =
    opciones?.habilitado === false ||
    opciones?.tieneEvidencia === false ||
    (opciones?.estadoSolicitud === "BORRADOR" && !opciones?.tieneEvidencia);

  const [estado, setEstado] = useState<EstadoEvidencia>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (sinFotoInicial) {
      return;
    }
    let activo = true;
    let objeto: string | null = null;
    obtenerEvidenciaAction(solicitudId)
      .then((res) => {
        if (!activo) return;
        if (!res.ok) {
          if (esMensajeSinFoto(res.mensaje)) {
            setEstado({ estado: "sin_foto", mensaje: MENSAJE_SIN_FOTO });
          } else {
            setEstado({ estado: "error", mensaje: res.mensaje || MENSAJE_ERROR });
          }
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
  }, [solicitudId, intento, sinFotoInicial]);

  const reintentar = useCallback(() => {
    setEstado({ estado: "cargando" });
    setIntento((n) => n + 1);
  }, []);
  const falloLaImagen = useCallback(
    () => setEstado({ estado: "error", mensaje: "La imagen recibida no se pudo mostrar." }),
    [],
  );

  const estadoEfectivo: EstadoEvidencia = sinFotoInicial
    ? { estado: "sin_foto", mensaje: MENSAJE_SIN_FOTO }
    : estado;

  return { estado: estadoEfectivo, reintentar, falloLaImagen };
}
