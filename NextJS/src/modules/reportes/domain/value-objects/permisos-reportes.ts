/**
 * Permisos por código del módulo de reportes (D-07: `[modulo].[accion]`, nunca
 * nombres de rol ni el comodín "*"). Son los códigos del seed del backend
 * (`apps/identidad/management/commands/seed_permisos.py`).
 *
 * Value Object puro: solo constantes, sin dependencias (capa `domain/`).
 */
export const PERMISO_REPORTES = {
  ver: "reportes.ver",
  generarPdf: "reportes.generar_pdf",
  generarExcel: "reportes.generar_excel",
  estadisticas: "reportes.estadisticas",
} as const;

/**
 * Filtros de estructura organizativa (Nivel, Dirección General, Dirección de
 * Línea, Coordinación). No se ocultan por rol: se muestran a quien puede
 * consultar la estructura, que es el permiso que exigen los catálogos del
 * backend (`organizacion.ver`) para llenar los selects.
 */
export const PERMISO_ESTRUCTURA_ORGANIZATIVA = "organizacion.ver";
