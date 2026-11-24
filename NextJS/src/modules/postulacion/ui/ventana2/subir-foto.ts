import { mapearVentana2 } from "../../infrastructure/mappers/mapper-postulacion";
import type { Ventana2DTO } from "../../application/dtos/postulacion-dto";

export type ResultadoSubida =
  | { ok: true; ventana2: Ventana2DTO }
  | { ok: false; mensaje: string; sesionCaida?: boolean };

/** Sube la foto por `XMLHttpRequest` (único modo de medir el progreso real) al Route Handler `/postulacion/foto`. */
export function subirFoto(archivo: File, alProgreso: (porcentaje: number) => void): Promise<ResultadoSubida> {
  return new Promise((resolver) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/postulacion/foto");
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alProgreso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => resolver({ ok: false, mensaje: "No pudimos conectar con el sistema. Revisa tu conexión e inténtalo de nuevo." });
    xhr.onload = () => {
      let cuerpo: { message?: string; data?: unknown } | null = null;
      try {
        cuerpo = JSON.parse(xhr.responseText) as { message?: string; data?: unknown };
      } catch {
        cuerpo = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && cuerpo?.data) {
        resolver({ ok: true, ventana2: mapearVentana2(cuerpo.data) });
        return;
      }
      if (xhr.status === 401 || cuerpo === null) {
        resolver({ ok: false, mensaje: "Tu sesión terminó. Ingresa de nuevo.", sesionCaida: true });
        return;
      }
      resolver({ ok: false, mensaje: cuerpo.message || "No fue posible subir la foto." });
    };
    const form = new FormData();
    form.set("foto", archivo, archivo.name);
    xhr.send(form);
  });
}

/** Mide el ancho y el alto de una imagen local. */
export function medirImagen(url: string): Promise<{ ancho: number; alto: number } | null> {
  return new Promise((resolver) => {
    const img = new Image();
    img.onload = () => resolver({ ancho: img.naturalWidth, alto: img.naturalHeight });
    img.onerror = () => resolver(null);
    img.src = url;
  });
}
