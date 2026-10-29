"use server";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type { ClaveCatalogo } from "../../domain/value-objects/campos-seccion";
import type { OpcionCatalogo } from "../../domain/ports/repo-catalogos-autogestion";
import type { FiltrosBandeja } from "../../domain/ports/repo-solicitudes";
import type {
  DatosComplementariosDTO,
  DecisionCampoDTO,
  ItemBorradorDTO,
  PaginaSolicitudesDTO,
  ResultadoAccion,
  SeccionDTO,
  SolicitudDTO,
  SolicitudDetalleDTO,
  SoporteDTO,
} from "../../application/dtos/solicitud-dto";
import {
  eliminarSoporte,
  enviarSolicitud,
  guardarBorrador,
  listarMisSolicitudes,
  listarSeccionesActivas,
  obtenerMiSolicitud,
  obtenerMisDatosComplementarios,
  solicitarActualizacion,
  subirSoporte,
} from "../../application/use-cases/gestionar-solicitud-trabajador";
import {
  decidirCambios,
  habilitarVentana,
  listarBandeja,
  obtenerComparativo,
  obtenerDetalleBienestar,
  prorrogarVentana,
  rechazarSolicitud,
} from "../../application/use-cases/gestionar-solicitud-bienestar";
import { repoSolicitudesApi } from "../repositories/repo-solicitudes-api";
import { repoCatalogosAutogestionApi } from "../repositories/repo-catalogos-autogestion-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idValido(id: string): string {
  if (!UUID.test(id)) throw new Error("El identificador de la solicitud no es válido.");
  return id;
}

/**
 * Ejecuta un caso de uso y devuelve un resultado serializable. Los errores se convierten en
 * mensajes en español (en producción Next oculta el texto de las excepciones de Server Actions).
 */
async function ejecutar<T>(
  nombre: string,
  mensajeOk: string,
  mensajeError: string,
  fn: () => Promise<T>,
): Promise<ResultadoAccion<T>> {
  const traceId = generateTraceId();
  const inicio = Date.now();
  try {
    const datos = await fn();
    await logAudit({ traceId, action: nombre, status: "SUCCESS", durationMs: Date.now() - inicio });
    return { ok: true, mensaje: mensajeOk, datos };
  } catch (error) {
    await logAudit({ traceId, action: nombre, status: "FAILED", durationMs: Date.now() - inicio });
    handleSessionExpired(error);
    return {
      ok: false,
      mensaje: error instanceof Error && error.message ? error.message : mensajeError,
    };
  }
}

// ── Trabajador ──
export async function listarMisSolicitudesAction(): Promise<ResultadoAccion<SolicitudDTO[]>> {
  return ejecutar("listarMisSolicitudesAction", "", "No se pudieron cargar sus solicitudes.", () =>
    listarMisSolicitudes(repoSolicitudesApi),
  );
}

export async function obtenerMiSolicitudAction(
  id: string,
): Promise<ResultadoAccion<SolicitudDetalleDTO>> {
  return ejecutar("obtenerMiSolicitudAction", "", "No se pudo cargar la solicitud.", () =>
    obtenerMiSolicitud(repoSolicitudesApi, idValido(id)),
  );
}

export async function listarSeccionesAction(): Promise<ResultadoAccion<SeccionDTO[]>> {
  return ejecutar("listarSeccionesAction", "", "No se pudieron cargar las secciones.", () =>
    listarSeccionesActivas(repoSolicitudesApi),
  );
}

export async function obtenerMisDatosComplementariosAction(): Promise<
  ResultadoAccion<DatosComplementariosDTO>
> {
  return ejecutar(
    "obtenerMisDatosComplementariosAction",
    "",
    "No se pudieron cargar sus datos complementarios.",
    () => obtenerMisDatosComplementarios(repoSolicitudesApi),
  );
}

export async function solicitarActualizacionAction(entrada: {
  secciones: string[];
  motivo: string;
}): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar(
    "solicitarActualizacionAction",
    "Solicitud registrada. Bienestar Social habilitará la ventana.",
    "No se pudo registrar la solicitud.",
    () => solicitarActualizacion(repoSolicitudesApi, entrada),
  );
}

export async function guardarBorradorAction(
  id: string,
  cambios: ItemBorradorDTO[],
  version?: number,
): Promise<ResultadoAccion<SolicitudDetalleDTO>> {
  return ejecutar(
    "guardarBorradorAction",
    "Borrador guardado.",
    "No se pudo guardar el borrador.",
    () => guardarBorrador(repoSolicitudesApi, idValido(id), cambios, version),
  );
}

/** Recibe `FormData` con `solicitudId`, `seccion`, `tipo` y `file` (límite de cuerpo: 25 MB, ver next.config). */
export async function subirSoporteAction(formData: FormData): Promise<ResultadoAccion<SoporteDTO>> {
  return ejecutar(
    "subirSoporteAction",
    "Soporte cargado.",
    "No se pudo cargar el soporte.",
    async () => {
      const archivo = formData.get("file");
      if (!(archivo instanceof File)) throw new Error("Seleccione un archivo.");
      return subirSoporte(repoSolicitudesApi, idValido(String(formData.get("solicitudId") ?? "")), {
        seccion: String(formData.get("seccion") ?? ""),
        tipo: String(formData.get("tipo") ?? ""),
        archivo,
      });
    },
  );
}

export async function eliminarSoporteAction(
  id: string,
  soporteId: string,
): Promise<ResultadoAccion> {
  return ejecutar(
    "eliminarSoporteAction",
    "Soporte eliminado.",
    "No se pudo eliminar el soporte.",
    async () => {
      await eliminarSoporte(repoSolicitudesApi, idValido(id), idValido(soporteId));
      return undefined;
    },
  );
}

export async function enviarSolicitudAction(id: string): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar(
    "enviarSolicitudAction",
    "Solicitud enviada a Bienestar Social.",
    "No se pudo enviar la solicitud.",
    () => enviarSolicitud(repoSolicitudesApi, idValido(id)),
  );
}

export async function listarCatalogoAction(
  clave: ClaveCatalogo,
  padreId?: number,
): Promise<ResultadoAccion<OpcionCatalogo[]>> {
  return ejecutar(
    "listarCatalogoAction",
    "",
    "No se pudieron cargar las opciones del catálogo.",
    () => repoCatalogosAutogestionApi.listar(clave, padreId),
  );
}

// ── Bienestar Social ──
export async function listarBandejaAction(
  filtros: Partial<FiltrosBandeja>,
): Promise<ResultadoAccion<PaginaSolicitudesDTO>> {
  return ejecutar("listarBandejaAction", "", "No se pudo cargar la bandeja de solicitudes.", () =>
    listarBandeja(repoSolicitudesApi, filtros),
  );
}

export async function obtenerDetalleBienestarAction(
  id: string,
): Promise<ResultadoAccion<SolicitudDetalleDTO>> {
  return ejecutar("obtenerDetalleBienestarAction", "", "No se pudo cargar la solicitud.", () =>
    obtenerDetalleBienestar(repoSolicitudesApi, idValido(id)),
  );
}

export async function obtenerComparativoAction(
  id: string,
): Promise<ResultadoAccion<SolicitudDetalleDTO>> {
  return ejecutar("obtenerComparativoAction", "", "No se pudo cargar el comparativo.", () =>
    obtenerComparativo(repoSolicitudesApi, idValido(id)),
  );
}

export async function habilitarVentanaAction(
  id: string,
  entrada: { plazoDias: number; secciones?: string[] },
): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar(
    "habilitarVentanaAction",
    "Ventana de actualización habilitada.",
    "No se pudo habilitar la ventana.",
    () => habilitarVentana(repoSolicitudesApi, idValido(id), entrada),
  );
}

export async function prorrogarVentanaAction(
  id: string,
  entrada: { nuevaFechaFin: string; motivo: string },
): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar(
    "prorrogarVentanaAction",
    "Ventana prorrogada.",
    "No se pudo prorrogar la ventana.",
    () => prorrogarVentana(repoSolicitudesApi, idValido(id), entrada),
  );
}

export async function decidirCambiosAction(
  id: string,
  entrada: { decisiones: DecisionCampoDTO[]; motivoGeneral?: string },
): Promise<ResultadoAccion<SolicitudDetalleDTO>> {
  return ejecutar(
    "decidirCambiosAction",
    "Decisión registrada.",
    "No se pudo registrar la decisión.",
    () => decidirCambios(repoSolicitudesApi, idValido(id), entrada),
  );
}

export async function rechazarSolicitudAction(
  id: string,
  motivo: string,
): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar(
    "rechazarSolicitudAction",
    "Solicitud rechazada.",
    "No se pudo rechazar la solicitud.",
    () => rechazarSolicitud(repoSolicitudesApi, idValido(id), motivo),
  );
}
