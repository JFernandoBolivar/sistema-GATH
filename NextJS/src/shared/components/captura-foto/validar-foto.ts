/** Reglas de la foto del trabajador (coherentes con el backend: JPG/PNG, máximo 5 MB). */
export const MAX_BYTES_FOTO = 5 * 1024 * 1024;
export const EXTENSIONES_FOTO = [".jpg", ".jpeg", ".png"] as const;
export const MIME_FOTO = ["image/jpeg", "image/png"] as const;

export type OrigenFoto = "CAMARA" | "ARCHIVO";

/** Mensaje de error en español o `null` si el archivo es una foto aceptable. */
export function validarFoto(
  archivo: { name: string; size: number; type?: string },
  maxBytes: number = MAX_BYTES_FOTO,
): string | null {
  if (archivo.size <= 0) return "El archivo está vacío.";
  if (archivo.size > maxBytes) {
    return `La foto supera el tamaño máximo de ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  }
  const i = archivo.name.lastIndexOf(".");
  const ext = i < 0 ? "" : archivo.name.slice(i).toLowerCase();
  const extensionOk = (EXTENSIONES_FOTO as readonly string[]).includes(ext);
  const mimeOk = !archivo.type || (MIME_FOTO as readonly string[]).includes(archivo.type);
  if (!extensionOk || !mimeOk) return "La foto debe ser un archivo JPG o PNG.";
  return null;
}

export type EstadoCamara =
  | { estado: "detectando" }
  | { estado: "disponible"; varias: boolean }
  | { estado: "no-disponible"; motivo: string };

/** Detecta si el dispositivo ofrece cámara. Nunca lanza: ante cualquier fallo informa el motivo. */
export async function detectarCamara(): Promise<EstadoCamara> {
  if (typeof window === "undefined") return { estado: "detectando" };
  if (!window.isSecureContext) {
    return {
      estado: "no-disponible",
      motivo:
        "La cámara solo funciona en una conexión segura (HTTPS). Puede subir una foto ya tomada.",
    };
  }
  const medios = navigator.mediaDevices;
  if (!medios?.getUserMedia) {
    return {
      estado: "no-disponible",
      motivo: "Este navegador no permite usar la cámara. Suba una foto.",
    };
  }
  try {
    const dispositivos = (await medios.enumerateDevices?.()) ?? [];
    const camaras = dispositivos.filter((d) => d.kind === "videoinput");
    if (camaras.length === 0) {
      return {
        estado: "no-disponible",
        motivo: "No se encontró ninguna cámara en este dispositivo. Suba una foto.",
      };
    }
    return { estado: "disponible", varias: camaras.length > 1 };
  } catch {
    return { estado: "no-disponible", motivo: "No se pudo comprobar la cámara. Suba una foto." };
  }
}

/** Traduce el error de `getUserMedia` a un mensaje claro. */
export function mensajeErrorCamara(error: unknown): string {
  const nombre = error instanceof DOMException ? error.name : "";
  switch (nombre) {
    case "NotAllowedError":
    case "SecurityError":
      return "No se concedió el permiso de la cámara. Permítalo en el navegador o suba una foto.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No se encontró una cámara disponible. Suba una foto.";
    case "NotReadableError":
      return "La cámara está siendo usada por otra aplicación. Ciérrela o suba una foto.";
    default:
      return "No se pudo abrir la cámara. Suba una foto.";
  }
}
