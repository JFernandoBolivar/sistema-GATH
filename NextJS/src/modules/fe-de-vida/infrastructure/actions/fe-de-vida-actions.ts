"use server";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type {
  CoberturaDTO,
  DetalleRevisionDTO,
  DetalleSolicitudDTO,
  EvidenciaImagenDTO,
  PaginaDTO,
  ProcesoDTO,
  ProrrogaDTO,
  ResultadoAccion,
  SolicitudDTO,
  TipoPensionDTO,
  VigenteDTO,
} from "../../application/dtos/fe-de-vida-dto";
import {
  descargarConstancia,
  enviarSolicitud,
  guardarBorrador,
  iniciarSolicitud,
  listarMisSolicitudes,
  obtenerMiSolicitud,
  obtenerVigente,
  subirEvidencia,
} from "../../application/use-cases/gestionar-fe-de-vida-pasivo";
import {
  aprobarDirecto,
  devolverSolicitud,
  listarBandeja,
  obtenerDetalleRevision,
  obtenerEvidencia,
  rechazarSolicitud,
  registrarCheck,
  retirarCheck,
} from "../../application/use-cases/gestionar-fe-de-vida-bienestar";
import {
  abrirProceso,
  cerrarProceso,
  crearProceso,
  editarProceso,
  listarCobertura,
  listarProcesos,
  listarProrrogas,
  listarTiposPension,
  prorrogarProceso,
} from "../../application/use-cases/gestionar-procesos";
import type {
  CambioEntrada,
  DatosProceso,
  DatosProrroga,
  FiltrosBandeja,
  FiltrosCobertura,
  FiltrosHistorial,
  FiltrosProcesos,
} from "../../domain/ports/repo-fe-de-vida";
import { repoFeDeVidaApi as repo } from "../repositories/repo-fe-de-vida-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idValido(id: string): string {
  if (!UUID.test(id)) throw new Error("El identificador no es válido.");
  return id;
}

/** Ejecuta un caso de uso y devuelve un resultado serializable con mensajes en español. */
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

// ── Pasivo ──
export async function obtenerVigenteAction(): Promise<ResultadoAccion<VigenteDTO | null>> {
  return ejecutar("feDeVida.vigente", "", "No se pudo cargar el proceso de fe de vida.", () =>
    obtenerVigente(repo),
  );
}

export async function iniciarSolicitudAction(): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar("feDeVida.iniciar", "Solicitud iniciada.", "No se pudo iniciar la solicitud.", () =>
    iniciarSolicitud(repo),
  );
}

export async function listarMisSolicitudesAction(
  filtros: Partial<FiltrosHistorial> = {},
): Promise<ResultadoAccion<PaginaDTO<SolicitudDTO>>> {
  return ejecutar("feDeVida.historial", "", "No se pudo cargar su historial.", () =>
    listarMisSolicitudes(repo, filtros),
  );
}

export async function obtenerMiSolicitudAction(
  id: string,
): Promise<ResultadoAccion<DetalleSolicitudDTO>> {
  return ejecutar("feDeVida.miSolicitud", "", "No se pudo cargar la solicitud.", () =>
    obtenerMiSolicitud(repo, idValido(id)),
  );
}

export async function guardarBorradorAction(
  id: string,
  cambios: CambioEntrada[],
): Promise<ResultadoAccion<DetalleSolicitudDTO>> {
  return ejecutar("feDeVida.borrador", "Borrador guardado.", "No se pudo guardar el borrador.", () =>
    guardarBorrador(repo, idValido(id), cambios),
  );
}

/** `formData`: `solicitudId`, `file` y `origen` (CAMARA | ARCHIVO). */
export async function subirEvidenciaAction(formData: FormData): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar("feDeVida.evidencia", "Foto cargada.", "No se pudo cargar la foto.", async () => {
    const archivo = formData.get("file");
    if (!(archivo instanceof File)) throw new Error("Seleccione una foto.");
    const origen = String(formData.get("origen") ?? "");
    if (origen !== "CAMARA" && origen !== "ARCHIVO") {
      throw new Error("El origen de la foto debe ser CAMARA o ARCHIVO.");
    }
    return subirEvidencia(repo, idValido(String(formData.get("solicitudId") ?? "")), {
      archivo,
      origen,
      metadatos: { nombre_archivo: archivo.name, tamano_bytes: archivo.size },
    });
  });
}

export async function enviarSolicitudAction(id: string): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar(
    "feDeVida.enviar",
    "Su fe de vida fue enviada a Bienestar Social.",
    "No se pudo enviar la solicitud.",
    () => enviarSolicitud(repo, idValido(id)),
  );
}

/** Constancia en PDF como base64 (las Server Actions no devuelven binarios). */
export async function descargarConstanciaAction(id: string): Promise<ResultadoAccion<string>> {
  return ejecutar("feDeVida.constancia", "", "No se pudo descargar la constancia.", async () => {
    const blob = await descargarConstancia(repo, idValido(id));
    return Buffer.from(await blob.arrayBuffer()).toString("base64");
  });
}

// ── Bienestar ──
export async function listarBandejaAction(
  filtros: Partial<FiltrosBandeja> = {},
): Promise<ResultadoAccion<PaginaDTO<SolicitudDTO>>> {
  return ejecutar("feDeVida.bandeja", "", "No se pudo cargar la bandeja.", () =>
    listarBandeja(repo, filtros),
  );
}

export async function obtenerDetalleRevisionAction(
  id: string,
): Promise<ResultadoAccion<DetalleRevisionDTO>> {
  return ejecutar("feDeVida.detalle", "", "No se pudo cargar la solicitud.", () =>
    obtenerDetalleRevision(repo, idValido(id)),
  );
}

/** Foto con la cédula: Django la sirve; la sesión viaja en el servidor y el navegador nunca ve el token. */
export async function obtenerEvidenciaAction(
  id: string,
): Promise<ResultadoAccion<EvidenciaImagenDTO>> {
  return ejecutar("feDeVida.evidencia", "", "No se pudo obtener la foto.", () =>
    obtenerEvidencia(repo, idValido(id)),
  );
}

export async function registrarCheckAction(id: string): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar("feDeVida.check", "Check registrado.", "No se pudo registrar el check.", () =>
    registrarCheck(repo, idValido(id)),
  );
}

export async function retirarCheckAction(
  id: string,
  motivo: string,
): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar("feDeVida.retirarCheck", "Check retirado.", "No se pudo retirar el check.", () =>
    retirarCheck(repo, idValido(id), motivo),
  );
}

export async function aprobarDirectoAction(
  id: string,
  justificacion: string,
): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar("feDeVida.aprobarDirecto", "Solicitud aprobada.", "No se pudo aprobar.", () =>
    aprobarDirecto(repo, idValido(id), justificacion),
  );
}

export async function devolverSolicitudAction(
  id: string,
  motivo: string,
  requiereNuevaFoto: boolean,
): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar(
    "feDeVida.devolver",
    "Solicitud devuelta para corrección.",
    "No se pudo devolver la solicitud.",
    () => devolverSolicitud(repo, idValido(id), motivo, requiereNuevaFoto),
  );
}

export async function rechazarSolicitudAction(
  id: string,
  motivo: string,
): Promise<ResultadoAccion<SolicitudDTO>> {
  return ejecutar("feDeVida.rechazar", "Solicitud rechazada.", "No se pudo rechazar.", () =>
    rechazarSolicitud(repo, idValido(id), motivo),
  );
}

// ── Procesos y prórrogas ──
export async function listarProcesosAction(
  filtros: Partial<FiltrosProcesos> = {},
): Promise<ResultadoAccion<PaginaDTO<ProcesoDTO>>> {
  return ejecutar("feDeVida.procesos", "", "No se pudieron cargar los procesos.", () =>
    listarProcesos(repo, filtros),
  );
}

export async function listarTiposPensionAction(): Promise<ResultadoAccion<TipoPensionDTO[]>> {
  return ejecutar("feDeVida.tiposPension", "", "No se pudieron cargar los tipos de pensión.", () =>
    listarTiposPension(repo),
  );
}

export async function crearProcesoAction(datos: DatosProceso): Promise<ResultadoAccion<ProcesoDTO>> {
  return ejecutar("feDeVida.crearProceso", "Proceso creado.", "No se pudo crear el proceso.", () =>
    crearProceso(repo, datos),
  );
}

export async function editarProcesoAction(
  id: string,
  datos: DatosProceso,
): Promise<ResultadoAccion<ProcesoDTO>> {
  return ejecutar("feDeVida.editarProceso", "Proceso actualizado.", "No se pudo guardar el proceso.", () =>
    editarProceso(repo, idValido(id), datos),
  );
}

export async function abrirProcesoAction(id: string): Promise<ResultadoAccion<ProcesoDTO>> {
  return ejecutar("feDeVida.abrirProceso", "Proceso abierto.", "No se pudo abrir el proceso.", () =>
    abrirProceso(repo, idValido(id)),
  );
}

export async function cerrarProcesoAction(id: string): Promise<ResultadoAccion<ProcesoDTO>> {
  return ejecutar("feDeVida.cerrarProceso", "Proceso cerrado.", "No se pudo cerrar el proceso.", () =>
    cerrarProceso(repo, idValido(id)),
  );
}

export async function listarProrrogasAction(
  procesoId: string,
): Promise<ResultadoAccion<ProrrogaDTO[]>> {
  return ejecutar("feDeVida.prorrogas", "", "No se pudo cargar el historial de prórrogas.", () =>
    listarProrrogas(repo, idValido(procesoId)),
  );
}

export async function prorrogarProcesoAction(
  procesoId: string,
  datos: DatosProrroga,
): Promise<ResultadoAccion<ProrrogaDTO>> {
  return ejecutar("feDeVida.prorrogar", "Prórroga concedida.", "No se pudo conceder la prórroga.", () =>
    prorrogarProceso(repo, idValido(procesoId), datos),
  );
}

// ── Cobertura ──
export async function listarCoberturaAction(
  filtros: Partial<FiltrosCobertura> = {},
): Promise<ResultadoAccion<PaginaDTO<CoberturaDTO>>> {
  return ejecutar("feDeVida.cobertura", "", "No se pudo cargar la cobertura.", () =>
    listarCobertura(repo, filtros),
  );
}
