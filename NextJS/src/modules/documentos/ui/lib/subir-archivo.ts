/**
 * Sube un archivo (multipart, campo «archivo») al route handler del módulo y notifica el progreso.
 * `XMLHttpRequest` porque `fetch` no informa del avance de la subida.
 */
export interface RespuestaSubida<T> {
  ok: boolean;
  data?: T;
  message?: string;
  errores?: Record<string, string[]>;
}

export function subirArchivo<T>(
  url: string,
  archivo: File,
  alProgreso?: (porcentaje: number) => void,
): Promise<RespuestaSubida<T>> {
  return new Promise((resolver) => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alProgreso?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => resolver({ ok: false, message: "No se pudo enviar el archivo. Revise su conexión." });
    xhr.onload = () => {
      try {
        const cuerpo = JSON.parse(xhr.responseText) as RespuestaSubida<T>;
        resolver({ ...cuerpo, ok: xhr.status >= 200 && xhr.status < 300 && cuerpo.ok !== false });
      } catch {
        resolver({ ok: false, message: `Respuesta inesperada del servidor (${xhr.status}).` });
      }
    };
    xhr.send(fd);
  });
}

export const MAX_BYTES_FONDO_DEFECTO = 15 * 1024 * 1024;
export const MAX_BYTES_LOGO_DEFECTO = 2 * 1024 * 1024;

/** Validación en el cliente del PDF de fondo; `null` si es válido. */
export function validarPdfFondo(archivo: { name: string; type?: string; size: number }, maxBytes = MAX_BYTES_FONDO_DEFECTO): string | null {
  if (!archivo.name.toLowerCase().endsWith(".pdf") && archivo.type !== "application/pdf") {
    return "El archivo debe ser un PDF (.pdf).";
  }
  if (archivo.size > maxBytes) return `El PDF debe pesar hasta ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  if (archivo.size === 0) return "El archivo está vacío.";
  return null;
}

/** Validación del logo (PNG/JPEG); `null` si es válido. */
export function validarLogo(archivo: { name: string; type?: string; size: number }, maxBytes = MAX_BYTES_LOGO_DEFECTO): string | null {
  const ok = /\.(png|jpe?g)$/i.test(archivo.name) || archivo.type === "image/png" || archivo.type === "image/jpeg";
  if (!ok) return "El logo debe ser una imagen PNG o JPEG.";
  if (archivo.size > maxBytes) return `El logo debe pesar hasta ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  return null;
}

/** URL (por el proxy GET con lista blanca) del PNG de la página `numero` del PDF de fondo. `version` rompe la caché al subir otro PDF. */
export function urlPaginaFondo(plantillaId: string, numero: number, version: string | number): string {
  return `/api/v1/documentos/plantillas/${plantillaId}/fondo/paginas/${numero}?v=${encodeURIComponent(String(version))}`;
}
