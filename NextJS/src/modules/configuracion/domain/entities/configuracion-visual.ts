/**
 * Entidad de Dominio de Configuración Visual (HU 0009 — Cintillo Editable).
 * GENERICO es de solo lectura (RN-009-01); FIJO es editable (nombre,
 * color, y 3 imágenes posicionadas: logo izquierdo, logo derecho, cintillo
 * de pie de página).
 */
export type TipoCintillo = "GENERICO" | "FIJO";

export interface ConfiguracionVisual {
  id: number;
  tipoCintillo: TipoCintillo;
  nombreEmpresa: string | null;
  logoPrincipalClave: string | null;
  logoPrincipalUrl: string | null;
  logoSecundarioClave: string | null;
  logoSecundarioUrl: string | null;
  cintilloPieClave: string | null;
  cintilloPieUrl: string | null;
  colorFondo: string | null;
  actualizadoPorId: number | null;
  actualizadoEn: string | null;
}
