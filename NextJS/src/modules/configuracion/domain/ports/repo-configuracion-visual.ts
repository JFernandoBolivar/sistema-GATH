/**
 * Puerto del Repositorio de Configuración Visual (Reglas R1, R4).
 */
import type { ConfiguracionVisual, TipoCintillo } from "../entities/configuracion-visual";

export type CampoLogo = "logo_principal_clave" | "logo_secundario_clave" | "cintillo_pie_clave";

export interface ActualizarConfiguracionVisualInput {
  tipoCintillo?: TipoCintillo;
  nombreEmpresa?: string | null;
  colorFondo?: string | null;
}

export interface RepoConfiguracionVisual {
  obtener(): Promise<ConfiguracionVisual>;
  actualizar(datos: ActualizarConfiguracionVisualInput): Promise<ConfiguracionVisual>;
  subirLogo(campo: CampoLogo, archivo: File): Promise<ConfiguracionVisual>;
}
