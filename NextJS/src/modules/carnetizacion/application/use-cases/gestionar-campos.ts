/**
 * Casos de uso para el Registro de Campos autorizados y personalizados (O44 - E5).
 */
import type { CampoCredencial } from "../../domain/entities/carnet";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";

export async function listarCamposCredencial(
  repo: RepoCarnetizacion,
  tipo: string = "trabajador"
): Promise<CampoCredencial[]> {
  return repo.listarCampos(tipo);
}

export async function crearCampoPersonalizado(
  repo: RepoCarnetizacion,
  campo: {
    codigo: string;
    etiqueta: string;
    grupo?: string;
    tipo_credencial?: string;
    sensible?: boolean;
    descripcion?: string;
    valor_ejemplo?: string;
  }
): Promise<CampoCredencial> {
  return repo.crearCampoPersonalizado(campo);
}

export async function eliminarCampoPersonalizado(
  repo: RepoCarnetizacion,
  codigo: string
): Promise<boolean> {
  return repo.eliminarCampoPersonalizado(codigo);
}
