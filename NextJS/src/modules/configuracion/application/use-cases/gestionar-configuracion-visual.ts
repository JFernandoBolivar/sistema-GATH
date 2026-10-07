/**
 * Casos de uso de Configuración Visual (Reglas R2, R4).
 */
import type { CampoLogo, RepoConfiguracionVisual } from "../../domain/ports/repo-configuracion-visual";
import type { ActualizarConfiguracionVisualInputDTO, ConfiguracionVisualDTO } from "../dtos/configuracion-visual-dto";

function aDTO(e: Awaited<ReturnType<RepoConfiguracionVisual["obtener"]>>): ConfiguracionVisualDTO {
  return {
    id: e.id,
    tipoCintillo: e.tipoCintillo,
    nombreEmpresa: e.nombreEmpresa,
    logoPrincipalClave: e.logoPrincipalClave,
    logoPrincipalUrl: e.logoPrincipalUrl,
    logoSecundarioClave: e.logoSecundarioClave,
    logoSecundarioUrl: e.logoSecundarioUrl,
    cintilloPieClave: e.cintilloPieClave,
    cintilloPieUrl: e.cintilloPieUrl,
    colorFondo: e.colorFondo,
    actualizadoPorId: e.actualizadoPorId,
    actualizadoEn: e.actualizadoEn,
  };
}

export async function obtenerConfiguracionVisual(repo: RepoConfiguracionVisual): Promise<ConfiguracionVisualDTO> {
  return aDTO(await repo.obtener());
}

export async function actualizarConfiguracionVisual(
  repo: RepoConfiguracionVisual,
  datos: ActualizarConfiguracionVisualInputDTO,
): Promise<ConfiguracionVisualDTO> {
  return aDTO(await repo.actualizar(datos));
}

export async function subirLogoConfiguracion(
  repo: RepoConfiguracionVisual,
  campo: CampoLogo,
  archivo: File,
): Promise<ConfiguracionVisualDTO> {
  return aDTO(await repo.subirLogo(campo, archivo));
}
