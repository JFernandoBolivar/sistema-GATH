/** Reglas de archivo de los soportes (espejo de `validacion_archivo.py` del backend; el servidor revalida). */

export const MAX_BYTES_SOPORTE = 10 * 1024 * 1024;
export const MAX_BYTES_FOTO = 5 * 1024 * 1024;

export const EXTENSIONES_SOPORTE = [".pdf", ".jpg", ".jpeg", ".png"] as const;
export const EXTENSIONES_FOTO = [".jpg", ".jpeg", ".png"] as const;

export interface ArchivoBasico {
  name: string;
  size: number;
}

function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i < 0 ? "" : nombre.slice(i).toLowerCase();
}

/** Devuelve el mensaje de error (español) o `null` si el archivo es aceptable. */
export function validarArchivoSoporte(archivo: ArchivoBasico, esFoto: boolean): string | null {
  if (archivo.size <= 0) return "El archivo está vacío.";
  const maximo = esFoto ? MAX_BYTES_FOTO : MAX_BYTES_SOPORTE;
  if (archivo.size > maximo) {
    return `El archivo supera el tamaño máximo de ${maximo / (1024 * 1024)} MB.`;
  }
  const permitidas: readonly string[] = esFoto ? EXTENSIONES_FOTO : EXTENSIONES_SOPORTE;
  if (!permitidas.includes(extensionDe(archivo.name))) {
    return esFoto
      ? "La foto debe ser JPG o PNG."
      : "El soporte debe ser un archivo PDF, JPG o PNG.";
  }
  return null;
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
