import type { FiltrosBandeja, RepoSolicitudes } from "../../domain/ports/repo-solicitudes";
import { validarDecisiones } from "../../domain/services/reglas-decision";
import type {
  DecisionCampoDTO,
  PaginaSolicitudesDTO,
  SolicitudDTO,
  SolicitudDetalleDTO,
} from "../dtos/solicitud-dto";

export const PLAZO_MIN_DIAS = 1;
export const PLAZO_MAX_DIAS = 90;
export const LIMITE_BANDEJA = 10;
export const LIMITE_MAXIMO_BANDEJA = 50;

export async function listarBandeja(
  repo: RepoSolicitudes,
  filtros: Partial<FiltrosBandeja> = {},
): Promise<PaginaSolicitudesDTO> {
  const limit = Math.min(Math.max(filtros.limit ?? LIMITE_BANDEJA, 1), LIMITE_MAXIMO_BANDEJA);
  const offset = Math.max(filtros.offset ?? 0, 0);
  return repo.listarBandeja({
    estado: filtros.estado || undefined,
    cedula: filtros.cedula?.trim() || undefined,
    limit,
    offset,
  });
}

export async function obtenerDetalleBienestar(
  repo: RepoSolicitudes,
  id: string,
): Promise<SolicitudDetalleDTO> {
  return repo.obtenerDetalle(id);
}

/** Comparativo valor actual / propuesto con soportes y avisos de conflicto. */
export async function obtenerComparativo(
  repo: RepoSolicitudes,
  id: string,
): Promise<SolicitudDetalleDTO> {
  return repo.obtenerComparativo(id);
}

export async function habilitarVentana(
  repo: RepoSolicitudes,
  id: string,
  entrada: { plazoDias: number; secciones?: string[] },
): Promise<SolicitudDTO> {
  if (
    !Number.isInteger(entrada.plazoDias) ||
    entrada.plazoDias < PLAZO_MIN_DIAS ||
    entrada.plazoDias > PLAZO_MAX_DIAS
  ) {
    throw new Error(
      `El plazo debe ser un número entero de ${PLAZO_MIN_DIAS} a ${PLAZO_MAX_DIAS} días.`,
    );
  }
  if (entrada.secciones && entrada.secciones.length === 0) {
    throw new Error("Habilite al menos una sección.");
  }
  return repo.habilitar(id, entrada.plazoDias, entrada.secciones);
}

export async function prorrogarVentana(
  repo: RepoSolicitudes,
  id: string,
  entrada: { nuevaFechaFin: string; motivo: string },
): Promise<SolicitudDTO> {
  if (Number.isNaN(new Date(entrada.nuevaFechaFin).getTime()))
    throw new Error("Indique una fecha límite válida.");
  if (!entrada.motivo.trim()) throw new Error("Indique el motivo de la prórroga.");
  return repo.prorrogar(id, entrada.nuevaFechaFin, entrada.motivo.trim());
}

/**
 * Decide campo por campo. Una sola persona aprueba (Analista o Administradora): no hay segunda aprobación.
 * Se valida en el cliente lo que el servidor exigirá para evitar un viaje inútil.
 */
export async function decidirCambios(
  repo: RepoSolicitudes,
  id: string,
  entrada: { decisiones: DecisionCampoDTO[]; motivoGeneral?: string },
): Promise<SolicitudDetalleDTO> {
  const detalle = await repo.obtenerComparativo(id);
  const errores = validarDecisiones(
    detalle.cambios,
    entrada.decisiones,
    entrada.motivoGeneral ?? "",
  );
  if (errores.length > 0) throw new Error(errores.join(" "));
  const pendientes = new Set(
    detalle.cambios.filter((c) => c.decision === "PENDIENTE").map((c) => c.id),
  );
  return repo.decidir(id, {
    version: detalle.version,
    decisiones: entrada.decisiones.filter((d) => pendientes.has(d.cambioId)),
    motivoGeneral: entrada.motivoGeneral?.trim() || undefined,
  });
}

/** Bienestar devuelve una solicitud ENVIADA con motivo obligatorio; el trabajador corrige y reenvía. */
export async function devolverSolicitud(
  repo: RepoSolicitudes,
  id: string,
  motivo: string,
): Promise<SolicitudDTO> {
  if (!motivo.trim()) throw new Error("Indique el motivo de la devolución.");
  return repo.devolver(id, motivo.trim());
}

export async function rechazarSolicitud(
  repo: RepoSolicitudes,
  id: string,
  motivo: string,
): Promise<SolicitudDTO> {
  if (!motivo.trim()) throw new Error("Indique el motivo del rechazo.");
  return repo.rechazar(id, motivo.trim());
}
