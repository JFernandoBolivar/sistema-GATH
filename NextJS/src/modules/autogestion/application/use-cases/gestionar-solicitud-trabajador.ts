import type { RepoSolicitudes, SoporteNuevo } from "../../domain/ports/repo-solicitudes";
import { SECCIONES } from "../../domain/entities/solicitud-actualizacion";
import { validarArchivoSoporte } from "../../domain/services/validar-soporte";
import { validarEnvio } from "../../domain/services/reglas-solicitud";
import type {
  ItemBorradorDTO,
  SolicitudDTO,
  SolicitudDetalleDTO,
  SoporteDTO,
} from "../dtos/solicitud-dto";

const MOTIVO_MAX = 500;
const SECCIONES_VALIDAS: readonly string[] = SECCIONES;

export async function listarMisSolicitudes(repo: RepoSolicitudes): Promise<SolicitudDTO[]> {
  return repo.listarMias();
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

/** El trabajador pide actualizar secciones indicando el motivo; Bienestar habilita después la ventana. */
export async function solicitarActualizacion(
  repo: RepoSolicitudes,
  entrada: { secciones: string[]; motivo: string },
): Promise<SolicitudDTO> {
  const secciones = [...new Set(entrada.secciones)];
  if (secciones.length === 0) throw new Error("Elija al menos una sección para actualizar.");
  const desconocida = secciones.find((s) => !SECCIONES_VALIDAS.includes(s));
  if (desconocida) throw new Error(`La sección «${desconocida}» no es autogestionable.`);
  const motivo = entrada.motivo.trim();
  if (!motivo) throw new Error("Indique el motivo de la actualización.");
  if (motivo.length > MOTIVO_MAX)
    throw new Error(`El motivo no puede superar ${MOTIVO_MAX} caracteres.`);
  return repo.solicitar(secciones, motivo);
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
