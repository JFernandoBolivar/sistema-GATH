/**
 * Helpers de presentación puros para la vista de detalle de un familiar
 * (`detalle-familiar.tsx`). Sin React, testeables de forma aislada — mismo
 * patrón que `modules/personal/ui/expediente-detalle-view-model.ts`. El
 * formateo de fecha vive en `@/shared/lib/formato-fecha` (antes duplicado
 * aquí con `Intl.DateTimeFormat`, ponytail-audit
 * AUDITORIA_CALIDAD_FRONTEND_2026-09-15.md §8.1/§8.2 punto 7).
 */
const ETIQUETAS_DOCUMENTO: Record<string, string> = {
  cedula: "Cédula del familiar",
  partida_nacimiento: "Partida de nacimiento",
};

export function etiquetaDocumento(tipo: string): string {
  return ETIQUETAS_DOCUMENTO[tipo] ?? tipo;
}
