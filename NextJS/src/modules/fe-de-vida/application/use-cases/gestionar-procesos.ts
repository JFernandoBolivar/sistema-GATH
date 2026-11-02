import type {
  DatosProceso,
  DatosProrroga,
  FiltrosCobertura,
  FiltrosProcesos,
  RepoFeDeVida,
} from "../../domain/ports/repo-fe-de-vida";
import type {
  CoberturaDTO,
  PaginaDTO,
  ProcesoDTO,
  ProrrogaDTO,
  TipoPensionDTO,
} from "../dtos/fe-de-vida-dto";
import { exigirTexto } from "./gestionar-fe-de-vida-bienestar";
import { normalizarPagina, vacioAUndefined } from "./paginacion";

export function validarDatosProceso(d: DatosProceso): DatosProceso {
  const nombre = d.nombre.trim();
  if (!nombre) throw new Error("El nombre del proceso es obligatorio.");
  const apertura = Date.parse(d.apertura);
  const cierre = Date.parse(d.cierre);
  if (Number.isNaN(apertura) || Number.isNaN(cierre)) {
    throw new Error("Las fechas de apertura y cierre son obligatorias.");
  }
  if (cierre <= apertura) throw new Error("El cierre debe ser posterior a la apertura.");
  return { ...d, nombre, tiposNomina: [...new Set(d.tiposNomina)] };
}

export function listarProcesos(
  repo: RepoFeDeVida,
  filtros: Partial<FiltrosProcesos> = {},
): Promise<PaginaDTO<ProcesoDTO>> {
  return repo.listarProcesos({
    ...normalizarPagina(filtros.limit, filtros.offset),
    estado: vacioAUndefined(filtros.estado),
  });
}

export function listarTiposPension(repo: RepoFeDeVida): Promise<TipoPensionDTO[]> {
  return repo.listarTiposPension();
}

export async function crearProceso(repo: RepoFeDeVida, datos: DatosProceso): Promise<ProcesoDTO> {
  return repo.crearProceso(validarDatosProceso(datos));
}

export async function editarProceso(
  repo: RepoFeDeVida,
  id: string,
  datos: DatosProceso,
): Promise<ProcesoDTO> {
  return repo.editarProceso(id, validarDatosProceso(datos));
}

export function abrirProceso(repo: RepoFeDeVida, id: string): Promise<ProcesoDTO> {
  return repo.abrirProceso(id);
}

export function cerrarProceso(repo: RepoFeDeVida, id: string): Promise<ProcesoDTO> {
  return repo.cerrarProceso(id);
}

export function listarProrrogas(repo: RepoFeDeVida, procesoId: string): Promise<ProrrogaDTO[]> {
  return repo.listarProrrogas(procesoId);
}

/** Prórroga individual (con cédula) o general (sin cédula); el motivo es obligatorio. */
export async function prorrogarProceso(
  repo: RepoFeDeVida,
  procesoId: string,
  datos: DatosProrroga,
): Promise<ProrrogaDTO> {
  if (Number.isNaN(Date.parse(datos.nuevaFechaLimite))) {
    throw new Error("La nueva fecha límite es obligatoria.");
  }
  const cedula = datos.cedula?.trim();
  if (cedula && !/^\d{5,10}$/.test(cedula)) throw new Error("La cédula debe tener entre 5 y 10 dígitos.");
  return repo.prorrogar(procesoId, {
    nuevaFechaLimite: datos.nuevaFechaLimite,
    motivo: exigirTexto(datos.motivo, "El motivo"),
    cedula: cedula || undefined,
  });
}

export function listarCobertura(
  repo: RepoFeDeVida,
  filtros: Partial<FiltrosCobertura> = {},
): Promise<PaginaDTO<CoberturaDTO>> {
  return repo.listarCobertura({
    ...normalizarPagina(filtros.limit, filtros.offset),
    texto: vacioAUndefined(filtros.texto),
    tipoNominaId: filtros.tipoNominaId && filtros.tipoNominaId > 0 ? filtros.tipoNominaId : undefined,
    sinCorreo: filtros.sinCorreo || undefined,
    sinCuenta: filtros.sinCuenta || undefined,
  });
}
