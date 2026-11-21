/** Reglas de captura del resultado psicofísico (espejo de las del backend, que vuelve a validar). */

export const MAX_BYTES_INFORME = 10 * 1024 * 1024;

/** Estados en los que el backend aún permite registrar o corregir el resultado. */
export const ESTADOS_PSICOFISICO_EDITABLE: ReadonlySet<string> = new Set([
  "PRE_REGISTRADO",
  "EN_CAPTURA",
  "ENVIADO_CAPTACION",
  "EN_CORRECCION_DATOS",
]);

/** Fecha de hoy (AAAA-MM-DD) en hora de Venezuela: tope del campo «fecha de aplicación». */
export function hoyEnVenezuela(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(ahora);
}

export interface ValoresPsicofisico {
  resultado: "" | "APTO" | "NO_APTO";
  fechaAplicacion: string;
  observaciones: string;
  informe: File | null;
}

/** Devuelve los errores por campo (vacío = válido). */
export function validarPsicofisico(v: ValoresPsicofisico, hoy: string = hoyEnVenezuela()): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!v.resultado) errores.resultado = "Seleccione el resultado.";
  if (!v.fechaAplicacion) errores.fechaAplicacion = "Indique la fecha de aplicación.";
  else if (v.fechaAplicacion > hoy) errores.fechaAplicacion = "La fecha de aplicación no puede ser futura.";
  if (v.informe) {
    const esPdf = v.informe.type === "application/pdf" || v.informe.name.toLowerCase().endsWith(".pdf");
    if (!esPdf) errores.informe = "El informe debe ser un archivo PDF.";
    else if (v.informe.size > MAX_BYTES_INFORME) errores.informe = "El informe supera los 10 MB.";
  }
  return errores;
}
