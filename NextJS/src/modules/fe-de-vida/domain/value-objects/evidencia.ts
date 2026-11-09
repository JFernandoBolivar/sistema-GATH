/** Reglas de la foto con la cédula (espejo del backend `validar_archivo`: JPG o PNG, hasta 5 MB). */
export const MAX_BYTES_EVIDENCIA = 5 * 1024 * 1024;
export const TIPOS_EVIDENCIA = ["image/jpeg", "image/png"] as const;
