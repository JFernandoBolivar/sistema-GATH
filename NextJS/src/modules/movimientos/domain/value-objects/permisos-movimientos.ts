/**
 * Permisos por código del módulo de movimientos (D-07: `[modulo].[accion]`,
 * nunca nombres de rol ni el comodín "*").
 *
 * Value Object puro: solo constantes, sin dependencias (capa `domain/`). Los
 * códigos son los del seed del backend
 * (`apps/identidad/management/commands/seed_permisos.py`).
 */
export const PERMISO_MOVIMIENTOS = {
  ver: "movimientos.ver",
  exportarPdf: "movimientos.exportar_pdf",
  exportarExcel: "movimientos.exportar_excel",
} as const;
