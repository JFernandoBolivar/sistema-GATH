/**
 * DTOs de Configuración Visual (Regla R5).
 */
export type TipoCintilloDTO = "GENERICO" | "FIJO";

export interface ConfiguracionVisualDTO {
  id: number;
  tipoCintillo: TipoCintilloDTO;
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

export interface ActualizarConfiguracionVisualInputDTO {
  tipoCintillo?: TipoCintilloDTO;
  nombreEmpresa?: string | null;
  colorFondo?: string | null;
}
