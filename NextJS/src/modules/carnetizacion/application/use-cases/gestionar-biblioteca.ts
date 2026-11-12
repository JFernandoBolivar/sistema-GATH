/**
 * Casos de uso para la Biblioteca compartida de medios (O44 - E4).
 */
import type { CategoriaBiblioteca, ElementoBiblioteca, PaginaCarnet, ParamsPagina } from "../../domain/entities/carnet";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";

export async function listarBiblioteca(
  repo: RepoCarnetizacion,
  categoria?: CategoriaBiblioteca
): Promise<ElementoBiblioteca[]> {
  return repo.listarBiblioteca(categoria);
}

export async function listarBibliotecaPagina(
  repo: RepoCarnetizacion,
  categoria: CategoriaBiblioteca | undefined,
  params: ParamsPagina,
): Promise<PaginaCarnet<ElementoBiblioteca>> {
  return repo.listarBibliotecaPagina(categoria, params);
}

export async function subirElementoBiblioteca(
  repo: RepoCarnetizacion,
  nombre: string,
  categoria: CategoriaBiblioteca,
  archivo: File,
  descripcion?: string
): Promise<ElementoBiblioteca> {
  return repo.subirElementoBiblioteca(nombre, categoria, archivo, descripcion);
}

export async function eliminarElementoBiblioteca(
  repo: RepoCarnetizacion,
  id: string
): Promise<boolean> {
  return repo.eliminarElementoBiblioteca(id);
}
