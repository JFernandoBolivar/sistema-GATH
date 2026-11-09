/** Permisos por código de la bitácora (D10). */
export const PERMISO_AUDITORIA = {
  verLogs: "auditoria.ver_logs",
  exportar: "auditoria.exportar",
  verSeguridad: "auditoria.ver_seguridad",
} as const;

export const RESULTADOS_AUDITORIA = ["SUCCESS", "FAILED", "DENIED"] as const;

export const ETIQUETA_RESULTADO: Record<string, string> = {
  SUCCESS: "Éxito",
  FAILED: "Fallido",
  DENIED: "Denegado",
};
