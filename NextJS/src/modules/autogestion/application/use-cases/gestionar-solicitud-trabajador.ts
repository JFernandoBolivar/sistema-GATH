import type {
  FiltrosMisSolicitudes,
  RepoSolicitudes,
  SoporteNuevo,
} from "../../domain/ports/repo-solicitudes";
import { LIMITE_BANDEJA, LIMITE_MAXIMO_BANDEJA } from "./gestionar-solicitud-bienestar";
import { seccionDeCampo } from "../../domain/value-objects/campos-seccion";
import { errorDeMotivo } from "../../domain/services/validar-motivo";
import { validarArchivoSoporte } from "../../domain/services/validar-soporte";
import { validarEnvio } from "../../domain/services/reglas-solicitud";
import type {
  ItemBorradorDTO,
  PaginaSolicitudesDTO,
  SolicitudDTO,
  SolicitudDetalleDTO,
  SoporteDTO,
} from "../dtos/solicitud-dto";

/** Página de las solicitudes propias: 10 por defecto, tope 50; filtros vacíos se omiten. */
export async function listarMisSolicitudes(
  repo: RepoSolicitudes,
  filtros: Partial<FiltrosMisSolicitudes> = {},
): Promise<PaginaSolicitudesDTO> {
  return repo.listarMias({
    estado: filtros.estado || undefined,
    fechaDesde: filtros.fechaDesde || undefined,
    fechaHasta: filtros.fechaHasta || undefined,
    limit: Math.min(Math.max(filtros.limit ?? LIMITE_BANDEJA, 1), LIMITE_MAXIMO_BANDEJA),
    offset: Math.max(filtros.offset ?? 0, 0),
  });
}

export async function obtenerMiSolicitud(
  repo: RepoSolicitudes,
  id: string,
): Promise<SolicitudDetalleDTO> {
  return repo.obtenerMia(id);
}

export async function listarSeccionesActivas(repo: RepoSolicitudes) {
  const secciones = await repo.listarSecciones();
  return secciones.filter((s) => s.activa);
}

export async function obtenerMisDatosComplementarios(repo: RepoSolicitudes) {
  return repo.obtenerMisDatosComplementarios();
}

/** El trabajador pide actualizar CAMPOS concretos con un solo motivo; Bienestar habilita después la ventana. */
export async function solicitarActualizacion(
  repo: RepoSolicitudes,
  entrada: { campos: string[]; motivo: string },
): Promise<SolicitudDTO> {
  const campos = [...new Set(entrada.campos)];
  if (campos.length === 0) throw new Error("Elija al menos un campo para actualizar.");
  const desconocido = campos.find((c) => !seccionDeCampo(c));
  if (desconocido) throw new Error(`El campo «${desconocido}» no es autogestionable.`);
  const errorMotivo = errorDeMotivo(entrada.motivo);
  if (errorMotivo) throw new Error(`${errorMotivo}.`);
  return repo.solicitar(campos, entrada.motivo.trim());
}

/** Reemplaza el borrador completo de la solicitud (la ficha real no cambia hasta la aprobación). */
export async function guardarBorrador(
  repo: RepoSolicitudes,
  id: string,
  cambios: ItemBorradorDTO[],
  version?: number,
): Promise<SolicitudDetalleDTO> {
  return repo.guardarBorrador(id, cambios, version);
}

export async function subirSoporte(
  repo: RepoSolicitudes,
  id: string,
  soporte: SoporteNuevo,
): Promise<SoporteDTO> {
  const error = validarArchivoSoporte(soporte.archivo, soporte.seccion === "foto");
  if (error) throw new Error(error);
  return repo.subirSoporte(id, soporte);
}

export async function eliminarSoporte(
  repo: RepoSolicitudes,
  id: string,
  soporteId: string,
): Promise<void> {
  return repo.eliminarSoporte(id, soporteId);
}

/** Valida en el cliente lo mismo que exige el servidor (cambios guardados y soportes obligatorios) y envía. */
export async function enviarSolicitud(repo: RepoSolicitudes, id: string): Promise<SolicitudDTO> {
  const [detalle, secciones] = await Promise.all([repo.obtenerMia(id), repo.listarSecciones()]);
  const errores = validarEnvio(detalle, secciones);
  if (errores.length > 0) throw new Error(errores.join(" "));
  return repo.enviar(id, detalle.version);
}
