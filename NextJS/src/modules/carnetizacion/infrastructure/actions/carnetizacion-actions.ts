"use server";

/**
 * Server Actions para Carnetización (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import type { ZodError } from "zod";

import {
  listarBiblioteca,
  subirElementoBiblioteca,
  eliminarElementoBiblioteca,
} from "../../application/use-cases/gestionar-biblioteca";
import {
  listarCamposCredencial,
  crearCampoPersonalizado,
  eliminarCampoPersonalizado,
} from "../../application/use-cases/gestionar-campos";
import {
  consultarFichaQrUC,
  consultarSaludEmergenciaUC,
  obtenerPreferenciasPrivacidadUC,
  guardarPreferenciasPrivacidadUC,
} from "../../application/use-cases/consultar-qr-ficha";
import type { CategoriaBiblioteca, PreferenciasPrivacidadCarnet } from "../../domain/entities/carnet";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  activarPlantillaCarnet,
  crearPlantillaCarnet,
  emitirCarnet,
  listarCarnets,
  listarPlantillasCarnet,
  revocarCarnet,
} from "../../application/use-cases/emitir-carnet";
import { obtenerDatosEmpleadoParaCarnet } from "../../application/use-cases/disenar-carnet";
import { obtenerEstadisticas } from "../../application/use-cases/obtener-estadisticas";
import { validarCarnetPorHash, validarCarnetPorId } from "../../application/use-cases/validar-qr";
import { repoCarnetizacionApi } from "../repositories/repo-carnetizacion-api";
import {
  buscarEmpleadoCarnetSchema,
  carnetIdSchema,
  emitirCarnetSchema,
  plantillaIdSchema,
  subirPlantillaCarnetSchema,
  validarHashSchema,
} from "../../ui/schema/schema-carnet";

/** Convierte los issues de Zod en `{ campo: ["mensaje"] }` para el formulario. */
function erroresDeZod(error: ZodError): Record<string, string[]> {
  const salida: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const ruta = issue.path.join(".");
    if (!ruta) continue;
    (salida[ruta] ??= []).push(issue.message);
  }
  return salida;
}

export async function getCarnetsAction(cedula?: string) {
  const cedulaValida = cedula ? cedula.trim() : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCarnets(repoCarnetizacionApi, cedulaValida);
    await logAudit({ traceId, action: "getCarnetsAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCarnetsAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function emitirCarnetAction(empleadoCedula: string, motivoId: number, observaciones?: string) {
  const validation = emitirCarnetSchema.safeParse({ empleadoCedula, motivoId, observaciones });
  if (!validation.success) {
    return {
      error: "Datos de emisión inválidos. Revise los campos marcados en rojo.",
      errores: erroresDeZod(validation.error),
    };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await emitirCarnet(repoCarnetizacionApi, validation.data.empleadoCedula, validation.data.motivoId, validation.data.observaciones);
    await logAudit({ traceId, action: "emitirCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "emitirCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible emitir el carnet.");
  }
}

export async function validarCarnetPorHashAction(securityHash: string) {
  const validation = validarHashSchema.safeParse({ securityHash });
  if (!validation.success) {
    return {
      error: "Hash de seguridad inválido.",
      errores: erroresDeZod(validation.error),
    };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await validarCarnetPorHash(repoCarnetizacionApi, validation.data.securityHash);
    await logAudit({ traceId, action: "validarCarnetPorHashAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "validarCarnetPorHashAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible validar el carnet.");
  }
}

export async function validarCarnetPorIdAction(carnetId: number) {
  const validation = carnetIdSchema.safeParse({ carnetId });
  if (!validation.success) {
    return { error: "Carnet inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await validarCarnetPorId(repoCarnetizacionApi, validation.data.carnetId);
    await logAudit({ traceId, action: "validarCarnetPorIdAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "validarCarnetPorIdAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible validar el carnet.");
  }
}

export async function getPlantillasCarnetAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarPlantillasCarnet(repoCarnetizacionApi);
    await logAudit({ traceId, action: "getPlantillasCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPlantillasCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function subirPlantillaCarnetAction(nombre: string, imagen: File, activar?: boolean) {
  const validation = subirPlantillaCarnetSchema.safeParse({ nombre, imagen, activar });
  if (!validation.success) {
    const errorMsg = validation.error.issues[0]?.message ?? "Datos de plantilla inválidos.";
    return { error: errorMsg, errores: erroresDeZod(validation.error) };
  }

  const { nombre: validNombre, imagen: validImagen, activar: validActivar } = validation.data;
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearPlantillaCarnet(repoCarnetizacionApi, validNombre, validImagen, validActivar);
    await logAudit({ traceId, action: "subirPlantillaCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "subirPlantillaCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible subir la plantilla.");
  }
}

export async function activarPlantillaCarnetAction(plantillaId: number) {
  const validation = plantillaIdSchema.safeParse({ plantillaId });
  if (!validation.success) {
    return { error: "Plantilla inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await activarPlantillaCarnet(repoCarnetizacionApi, validation.data.plantillaId);
    await logAudit({ traceId, action: "activarPlantillaCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "activarPlantillaCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible activar la plantilla.");
  }
}

export async function descargarPdfCarnetAction(carnetId: number) {
  const validation = carnetIdSchema.safeParse({ carnetId });
  if (!validation.success) {
    return { error: "Carnet inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoCarnetizacionApi.descargarPdf(validation.data.carnetId);
    await logAudit({ traceId, action: "descargarPdfCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "descargarPdfCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible descargar el carnet.");
  }
}

export async function revocarCarnetAction(carnetId: number) {
  const validation = carnetIdSchema.safeParse({ carnetId });
  if (!validation.success) {
    return { error: "Carnet inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await revocarCarnet(repoCarnetizacionApi, validation.data.carnetId);
    await logAudit({ traceId, action: "revocarCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "revocarCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible revocar el carnet.");
  }
}

export async function getEstadisticasCarnetsAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await obtenerEstadisticas(repoCarnetizacionApi);
    await logAudit({ traceId, action: "getEstadisticasCarnetsAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getEstadisticasCarnetsAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function buscarEmpleadoParaCarnetAction(cedula: string) {
  const validation = buscarEmpleadoCarnetSchema.safeParse({ cedula });
  if (!validation.success) {
    return {
      error: "Cédula inválida. Ingrese solo dígitos numéricos.",
      errores: erroresDeZod(validation.error),
    };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await obtenerDatosEmpleadoParaCarnet(repoCarnetizacionApi, validation.data.cedula);
    await logAudit({ traceId, action: "buscarEmpleadoParaCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    if (!result) {
      return { error: `No se encontraron datos para el trabajador con cédula ${validation.data.cedula}.` };
    }
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "buscarEmpleadoParaCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible consultar los datos del trabajador.");
  }
}

export async function buscarPersonalCarnetAction(query: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const { carnetizacionApi } = await import("../http/carnetizacion-api");
    const result = await carnetizacionApi.buscarPersonal(query);
    await logAudit({ traceId, action: "buscarPersonalCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "buscarPersonalCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getMotivosCarnetAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const { carnetizacionApi } = await import("../http/carnetizacion-api");
    const result = await carnetizacionApi.getMotivos();
    await logAudit({ traceId, action: "getMotivosCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getMotivosCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarVistaPreviaAction(cedula: string, nombre: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const { carnetizacionApi } = await import("../http/carnetizacion-api");
    const result = await carnetizacionApi.actualizarVistaPrevia(cedula, nombre);
    await logAudit({ traceId, action: "actualizarVistaPreviaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarVistaPreviaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { success: false as const, message: "Error al actualizar vista previa", vista_previa: "" };
  }
}

export async function subirFotoCarnetAction(cedula: string, nombre: string, foto: File) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const { carnetizacionApi } = await import("../http/carnetizacion-api");
    const result = await carnetizacionApi.subirFoto(cedula, nombre, foto);
    await logAudit({ traceId, action: "subirFotoCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "subirFotoCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { success: false as const, message: "Error al subir la foto", vista_previa: "" };
  }
}

export async function generarCarnetPdfAction(
  cedula: string,
  motivoId: number,
  nombre: string,
  plantillaId?: string,
) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const { carnetizacionApi } = await import("../http/carnetizacion-api");
    const blob = await carnetizacionApi.generarCarnetPdf(cedula, motivoId, nombre, plantillaId);
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    await logAudit({ traceId, action: "generarCarnetPdfAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, message: "Carnet generado exitosamente", data: base64 };
  } catch (error) {
    await logAudit({ traceId, action: "generarCarnetPdfAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { success: false as const, message: "Error al generar el carnet", data: null };
  }
}

export async function getTiposCredencialAction(grupo?: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoCarnetizacionApi.listarTiposCredencial(grupo);
    await logAudit({ traceId, action: "getTiposCredencialAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTiposCredencialAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return [];
  }
}

export async function getPlantillasMotorAction(tipo?: string, estado?: string, activas?: boolean) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoCarnetizacionApi.listarPlantillasMotor(tipo, estado, activas);
    await logAudit({ traceId, action: "getPlantillasMotorAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPlantillasMotorAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return [];
  }
}

export async function activarPlantillaMotorAction(plantillaId: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoCarnetizacionApi.activarPlantillaMotor(plantillaId);
    await logAudit({ traceId, action: "activarPlantillaMotorAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, data: result };
  } catch (error) {
    await logAudit({ traceId, action: "activarPlantillaMotorAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { success: false as const, error: "No fue posible activar la plantilla." };
  }
}

export async function publicarPlantillaMotorAction(plantillaId: string, activar: boolean = true) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoCarnetizacionApi.publicarPlantilla(plantillaId, activar);
    await logAudit({ traceId, action: "publicarPlantillaMotorAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, data: result };
  } catch (error) {
    await logAudit({ traceId, action: "publicarPlantillaMotorAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { success: false as const, error: "No fue posible publicar la versión de la plantilla." };
  }
}

export async function crearPlantillaBorradorAction(data: {
  nombre: string;
  codigo_tipo?: string;
  definicion?: Record<string, unknown>;
  ancho_mm?: number;
  alto_mm?: number;
  orientacion?: "vertical" | "horizontal";
  regla_criterio?: string;
  regla_valor?: string;
}) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoCarnetizacionApi.crearPlantillaBorrador({
      nombre: data.nombre,
      codigo_tipo: data.codigo_tipo ?? "trabajador",
      definicion: data.definicion ?? { anverso: [], reverso: [], bg: { anverso: "#ffffff", reverso: "#ffffff" } },
      ancho_mm: data.ancho_mm ?? 54.0,
      alto_mm: data.alto_mm ?? 85.6,
      orientacion: data.orientacion ?? "vertical",
      regla_criterio: data.regla_criterio ?? "todos",
      regla_valor: data.regla_valor ?? "*",
    });
    await logAudit({ traceId, action: "crearPlantillaBorradorAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, data: result };
  } catch (error) {
    await logAudit({ traceId, action: "crearPlantillaBorradorAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const mensaje = error instanceof Error ? error.message : "No fue posible crear el borrador de plantilla.";
    return { success: false as const, error: mensaje };
  }
}

export async function getVersionesPlantillaAction(raizId: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoCarnetizacionApi.listarVersionesPlantilla(raizId);
    await logAudit({ traceId, action: "getVersionesPlantillaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getVersionesPlantillaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return [];
  }
}

export async function getPlantillaMotorAction(id: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoCarnetizacionApi.obtenerPlantillaMotor(id);
    await logAudit({ traceId, action: "getPlantillaMotorAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, data: result };
  } catch (error) {
    await logAudit({ traceId, action: "getPlantillaMotorAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { success: false as const, error: "No se encontró la plantilla." };
  }
}

export async function actualizarPlantillaBorradorAction(
  id: string,
  data: {
    nombre?: string;
    definicion?: Record<string, unknown>;
    ancho_mm?: number;
    alto_mm?: number;
    orientacion?: "vertical" | "horizontal";
    regla_criterio?: string;
    regla_valor?: string;
    descripcion?: string;
  }
) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoCarnetizacionApi.actualizarPlantillaBorrador(id, data);
    await logAudit({ traceId, action: "actualizarPlantillaBorradorAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, data: result };
  } catch (error) {
    await logAudit({ traceId, action: "actualizarPlantillaBorradorAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const mensaje = error instanceof Error ? error.message : "No fue posible actualizar el borrador.";
    return { success: false as const, error: mensaje };
  }
}

// --- Biblioteca de Medios (O44 - E4) ---
export async function getBibliotecaAction(categoria?: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarBiblioteca(
      repoCarnetizacionApi,
      categoria as CategoriaBiblioteca | undefined
    );
    await logAudit({ traceId, action: "getBibliotecaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, data: result };
  } catch (error) {
    await logAudit({ traceId, action: "getBibliotecaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { success: false as const, error: "No fue posible listar la biblioteca de medios." };
  }
}

export async function subirElementoBibliotecaAction(formData: FormData) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const nombre = formData.get("nombre") as string;
    const categoria = formData.get("categoria") as CategoriaBiblioteca;
    const archivo = formData.get("archivo") as File;
    const descripcion = (formData.get("descripcion") as string) || undefined;

    if (!nombre || !categoria || !archivo) {
      return { success: false as const, error: "Nombre, categoría y archivo son obligatorios." };
    }

    const result = await subirElementoBiblioteca(
      repoCarnetizacionApi,
      nombre,
      categoria,
      archivo,
      descripcion
    );
    await logAudit({ traceId, action: "subirElementoBibliotecaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, data: result };
  } catch (error) {
    await logAudit({ traceId, action: "subirElementoBibliotecaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const mensaje = error instanceof Error ? error.message : "No fue posible subir el archivo.";
    return { success: false as const, error: mensaje };
  }
}

export async function eliminarElementoBibliotecaAction(id: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarElementoBiblioteca(repoCarnetizacionApi, id);
    await logAudit({ traceId, action: "eliminarElementoBibliotecaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarElementoBibliotecaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { success: false as const, error: "No fue posible eliminar el elemento de la biblioteca." };
  }
}

// --- Registro de Campos (O44 - E5) ---
export async function getCamposAction(tipo: string = "trabajador") {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCamposCredencial(repoCarnetizacionApi, tipo);
    await logAudit({ traceId, action: "getCamposAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, data: result };
  } catch (error) {
    await logAudit({ traceId, action: "getCamposAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { success: false as const, error: "No fue posible obtener los campos." };
  }
}

export async function crearCampoPersonalizadoAction(data: {
  codigo: string;
  etiqueta: string;
  grupo?: string;
  tipo_credencial?: string;
  sensible?: boolean;
  descripcion?: string;
  valor_ejemplo?: string;
}) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearCampoPersonalizado(repoCarnetizacionApi, data);
    await logAudit({ traceId, action: "crearCampoPersonalizadoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, data: result };
  } catch (error) {
    await logAudit({ traceId, action: "crearCampoPersonalizadoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const mensaje = error instanceof Error ? error.message : "No fue posible registrar el campo.";
    return { success: false as const, error: mensaje };
  }
}

export async function eliminarCampoPersonalizadoAction(codigo: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarCampoPersonalizado(repoCarnetizacionApi, codigo);
    await logAudit({ traceId, action: "eliminarCampoPersonalizadoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarCampoPersonalizadoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { success: false as const, error: "No fue posible eliminar el campo personalizado." };
  }
}

// --- Ficha QR y Privacidad por Dato (O44 - E9) ---
export async function consultarFichaQrAction(securityHash: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await consultarFichaQrUC(repoCarnetizacionApi, securityHash);
    await logAudit({ traceId, action: "consultarFichaQrAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "consultarFichaQrAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function consultarSaludEmergenciaAction(securityHash: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await consultarSaludEmergenciaUC(repoCarnetizacionApi, securityHash);
    await logAudit({ traceId, action: "consultarSaludEmergenciaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "consultarSaludEmergenciaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function obtenerPreferenciasPrivacidadAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await obtenerPreferenciasPrivacidadUC(repoCarnetizacionApi);
    await logAudit({ traceId, action: "obtenerPreferenciasPrivacidadAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "obtenerPreferenciasPrivacidadAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function guardarPreferenciasPrivacidadAction(preferencias: PreferenciasPrivacidadCarnet) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await guardarPreferenciasPrivacidadUC(repoCarnetizacionApi, preferencias);
    await logAudit({ traceId, action: "guardarPreferenciasPrivacidadAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "guardarPreferenciasPrivacidadAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}


