/**
 * Casos de uso de Configuración Visual (Reglas R2, R4).
 */
import type { CampoLogo, RepoConfiguracionVisual } from "../../domain/ports/repo-configuracion-visual";
import type {
  ActualizarConfiguracionVisualInputDTO,
  ConfiguracionVisualDTO,
  VersionImagenCintilloDTO,
} from "../dtos/configuracion-visual-dto";

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

export async function listarVersionesImagen(
  repo: RepoConfiguracionVisual,
  campo: CampoLogo,
): Promise<VersionImagenCintilloDTO[]> {
  const versiones = await repo.listarVersiones(campo);
  // Más reciente primero, sin depender del orden del servidor.
  return [...versiones].sort((a, b) => b.subidoEn.localeCompare(a.subidoEn));
}

export async function restaurarVersionImagen(
  repo: RepoConfiguracionVisual,
  campo: CampoLogo,
  versionId: string,
): Promise<ConfiguracionVisualDTO> {
  return aDTO(await repo.restaurarVersion(campo, versionId));
}
