/**
 * Reduce una foto en el navegador antes de subirla (QA 2026-11-03, rendimiento).
 *
 * Una foto de teléfono pesa 3-8 MB; a 1600 px por el lado mayor queda en ~300-500 KB y sigue
 * permitiendo reconocer el rostro y leer la cédula. Sube varias veces más rápido (datos móviles)
 * y el servidor la re-codifica en menos tiempo. Respeta la orientación EXIF. Si algo falla o la
 * foto ya es pequeña, devuelve el archivo original: nunca impide subir la foto.
 */
export const LADO_MAXIMO_PX = 1600;
const CALIDAD_JPEG = 0.85;

export async function reducirFoto(archivo: File, ladoMaximo = LADO_MAXIMO_PX): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return archivo;
  try {
    const imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
    if (escala >= 1 && archivo.size < 1_000_000) {
      imagen.close();
      return archivo;
    }
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    lienzo.getContext("2d")?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    imagen.close();
    const blob = await new Promise<Blob | null>((ok) =>
      lienzo.toBlob(ok, "image/jpeg", CALIDAD_JPEG),
    );
    if (!blob || blob.size >= archivo.size) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    return archivo;
  }
}
