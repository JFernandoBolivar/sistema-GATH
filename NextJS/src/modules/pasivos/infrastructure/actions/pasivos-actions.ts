"use server";

/**
 * Server Actions para Pasivos (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  actualizarPasivo,
  egresarPasivo,
  listarCatalogosRegistroPasivo,
  listarPasivos,
  listarPasivosPaginados,
  obtenerPasivoPorCedula,
  procesarEgreso,
  registrarPasivo,
} from "../../application/use-cases/gestionar-pasivos";
import { listarTiposNomina } from "../../application/use-cases/listar-catalogo-egreso";
import { listarCatalogosExpedientePasivo } from "../../application/use-cases/listar-catalogos-expediente";
import { repoPasivosApi } from "../repositories/repo-pasivos-api";
import {
  actualizarPasivoSchema,
  filtrosPasivosSchema,
  listadoPasivosSchema,
  pasivoCedulaSchema,
  procesarEgresoSchema,
  registrarPasivoSchema,
} from "../../ui/schema/schema-pasivo";

export async function getPasivosAction(busqueda?: string) {
  const validated = listadoPasivosSchema.safeParse({ busqueda });
  const busquedaValida = validated.success ? validated.data.busqueda : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarPasivos(repoPasivosApi, busquedaValida);
    await logAudit({ traceId, action: "getPasivosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPasivosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getPasivoPorCedulaAction(cedula: string) {
  const validation = pasivoCedulaSchema.safeParse({ cedula });
  if (!validation.success) {
    return { error: "Cédula inválida. Revise el formato ingresado." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await obtenerPasivoPorCedula(repoPasivosApi, validation.data.cedula);
    await logAudit({ traceId, action: "getPasivoPorCedulaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPasivoPorCedulaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

/** Error de una acción con, si el backend los dio, los errores por campo para `aplicarErroresServidor`. */
type ErrorAccionPasivo = { error: string; errores?: Record<string, string[]> };

export async function procesarEgresoAction(input: {
  cedula: string;
  motivoMovimientoId: number;
  tipoNominaId: number;
  liberarActivos: boolean;
  fechaEgreso?: string;
}): Promise<Awaited<ReturnType<typeof procesarEgreso>> | ErrorAccionPasivo> {
  const validation = procesarEgresoSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos de la transición inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await procesarEgreso(repoPasivosApi, validation.data);
    await logAudit({ traceId, action: "procesarEgresoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "procesarEgresoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const e = errorDeAccion(error, "No fue posible procesar el pase a pasivo.");
    return { error: e.error, errores: e.errores };
  }
}

export async function egresarPasivoAction(
  cedula: string,
  motivoId: number,
  familiarIds: number[],
): Promise<Awaited<ReturnType<typeof egresarPasivo>> | ErrorAccionPasivo> {
  const validacion = pasivoCedulaSchema.safeParse({ cedula });
  if (!validacion.success || !motivoId) {
    return { error: "Seleccione un pasivo y un motivo de egreso válido." };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await egresarPasivo(
      repoPasivosApi,
      validacion.data.cedula,
      motivoId,
      familiarIds,
    );
    await logAudit({ traceId, action: "egresarPasivoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "egresarPasivoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const e = errorDeAccion(error, "No fue posible egresar el pasivo.");
    return { error: e.error, errores: e.errores };
  }
}

export async function getTiposNominaAction(soloPasivos: boolean = true) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarTiposNomina(repoPasivosApi, soloPasivos);
    await logAudit({ traceId, action: "getTiposNominaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTiposNominaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCatalogosExpedientePasivoAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCatalogosExpedientePasivo(repoPasivosApi);
    await logAudit({ traceId, action: "getCatalogosExpedientePasivoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCatalogosExpedientePasivoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

/** PDF del expediente generado en backend (ReportLab); reemplaza el render client-side con @react-pdf/renderer. */
export async function descargarPasivoPdfAction(cedula: string) {
  const validation = pasivoCedulaSchema.safeParse({ cedula });
  if (!validation.success) {
    return { error: "Cédula inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const resultado = await repoPasivosApi.descargarPdf(validation.data.cedula);
    await logAudit({ traceId, action: "descargarPasivoPdfAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return resultado;
  } catch (error) {
    await logAudit({ traceId, action: "descargarPasivoPdfAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}


export async function getPasivosPaginadosAction(filtros: {
  cedula?: string;
  codigo?: string;
  tipoNominaId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  limit?: number;
  offset?: number;
}) {
  const validacion = filtrosPasivosSchema.safeParse(filtros);
  if (!validacion.success) {
    return { error: "Filtros del listado inválidos." };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarPasivosPaginados(repoPasivosApi, validacion.data);
    await logAudit({ traceId, action: "getPasivosPaginadosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPasivosPaginadosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarPasivoAction(
  cedula: string,
  input: {
    nombres?: string;
    apellidos?: string;
    correo?: string | null;
    telefonoMovil?: string | null;
    telefonoHabitacion?: string | null;
    carnetPatria?: string | null;
    carnetPatriaSerial?: string | null;
    fechaNacimiento?: string | null;
    estadoCivilId?: number | null;
    nacionalidadId?: number | null;
  },
) {
  const cedulaValida = pasivoCedulaSchema.safeParse({ cedula });
  const datosValidos = actualizarPasivoSchema.safeParse(input);
  if (!cedulaValida.success || !datosValidos.success) {
    return { error: "Datos del pasivo inválidos. Revise los campos ingresados." };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarPasivo(repoPasivosApi, cedulaValida.data.cedula, datosValidos.data);
    await logAudit({ traceId, action: "actualizarPasivoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarPasivoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return errorDeAccion(error, "No fue posible actualizar los datos del pasivo.");
  }
}

export async function registrarPasivoCompletoAction(
  dto: import("@/modules/personal/application/dtos/empleado-dto").GuardarEmpleadoInputDTO,
  tipoNominaId: number,
) {
  if (!dto.cedula?.trim() || !dto.nombres?.trim() || !dto.apellidos?.trim() || !dto.sexoId || !dto.fechaNacimiento) {
    return { error: "Complete los datos básicos del pasivo." };
  }
  if (!tipoNominaId) return { error: "Seleccione un tipo de nómina de pasivo." };

  const input = {
    cedula: dto.cedula.trim(),
    nombres: dto.nombres.trim(),
    apellidos: dto.apellidos.trim(),
    sexoId: dto.sexoId,
    fechaNacimiento: dto.fechaNacimiento,
    tipoNominaId,
    estadoCivilId: dto.estadoCivilId ?? null,
    nacionalidadId: dto.nacionalidadId ?? null,
    correo: dto.correo ?? null,
    telefonoMovil: dto.telefonoMovil ?? null,
    telefonoHabitacion: dto.telefonoHabitacion ?? null,
    carnetPatria: dto.carnetPatria ?? null,
    carnetPatriaSerial: dto.carnetPatriaSerial ?? null,
    datosVivienda: dto.datosVivienda
      ? {
          estado: dto.datosVivienda.estadoId ?? null,
          municipio: dto.datosVivienda.municipioId ?? null,
          parroquia: dto.datosVivienda.parroquiaId ?? null,
          direccion_exacta: dto.datosVivienda.direccionExacta ?? null,
          condicion_vivienda: dto.datosVivienda.condicionViviendaId ?? null,
          codigo_postal: dto.datosVivienda.codigoPostalId ?? null,
        }
      : undefined,
    perfilSalud: dto.perfilSalud
      ? {
          grupo_sanguineo_id: dto.perfilSalud.grupoSanguineoId ?? null,
          alergias: dto.perfilSalud.alergias ?? [],
          patologias_cronicas: dto.perfilSalud.patologiasCronicas ?? [],
          discapacidades: dto.perfilSalud.discapacidades ?? [],
        }
      : undefined,
    perfilFisico: dto.perfilFisico
      ? {
          talla_camisa_id: dto.perfilFisico.tallaCamisaId ?? null,
          talla_pantalon_id: dto.perfilFisico.tallaPantalonId ?? null,
          talla_zapatos_id: dto.perfilFisico.tallaZapatosId ?? null,
          talla_chaqueta_id: dto.perfilFisico.tallaChaquetaId ?? null,
        }
      : undefined,
    formacionAcademica: (dto.formacionAcademica ?? []).map((f) => ({
      nivel_academico: f.nivelAcademicoId ?? null,
      carrera: f.carreraId ?? null,
      mencion: f.mencionId ?? null,
      institucion: f.institucionId ?? null,
    })),
    formacionComplementaria: (dto.formacionComplementaria ?? []).map((f) => {
      const item = f as unknown as Record<string, unknown>;
      return {
        capacitacion: item.capacitacionId ?? null,
        institucion: item.institucionId ?? null,
        fechaInicio: item.fechaInicio ?? null,
        fechaFin: item.fechaFin ?? null,
        dias_completados: item.diasCompletados ?? null,
        horas_completadas: item.horasCompletadas ?? null,
        procedencia: item.procedenciaId ?? null,
        grupo: item.grupoId ?? null,
      };
    }),
    contactoEmergencia: (dto.contactoEmergencia ?? []).map((c) => ({
      nombres: c.nombres ?? "",
      apellidos: c.apellidos ?? "",
      telefono: c.telefono ?? null,
      relacion: c.relacionId ?? null,
    })),
    antecedentes: (dto.antecedentes ?? []).map((a) => ({
      organismo: a.organismoId ?? null,
      fecha_ingreso: a.fechaIngreso ?? null,
      fecha_egreso: a.fechaEgreso ?? null,
    })),
  };

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await registrarPasivo(repoPasivosApi, input);
    await logAudit({ traceId, action: "registrarPasivoCompletoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "registrarPasivoCompletoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    const mensaje = error instanceof Error && error.message ? error.message : "Error al registrar el pasivo";
    return { error: mensaje };
  }
}

export async function getCatalogosRegistroPasivoAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCatalogosRegistroPasivo(repoPasivosApi);
    await logAudit({ traceId, action: "getCatalogosRegistroPasivoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCatalogosRegistroPasivoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function registrarPasivoAction(input: unknown) {
  const validacion = registrarPasivoSchema.safeParse(input);
  if (!validacion.success) {
    return {
      error: validacion.error.issues[0]?.message ?? "Datos del pasivo inválidos.",
    };
  }
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await registrarPasivo(repoPasivosApi, validacion.data);
    await logAudit({ traceId, action: "registrarPasivoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "registrarPasivoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getFamiliaresTitularAction(cedula: string) {
  const validacion = pasivoCedulaSchema.safeParse({ cedula });
  if (!validacion.success) return { error: "Cédula del titular inválida." };
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoPasivosApi.getFamiliaresTitular(validacion.data.cedula);
    await logAudit({ traceId, action: "getFamiliaresTitularAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getFamiliaresTitularAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function registrarSobrevivientesAction(cedula: string, familiarIds: number[]) {
  const validacion = pasivoCedulaSchema.safeParse({ cedula });
  if (!validacion.success) return { error: "Cédula del titular inválida." };
  if (!familiarIds.length) return { error: "Seleccione al menos un familiar beneficiario." };
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoPasivosApi.registrarSobrevivientes(validacion.data.cedula, familiarIds);
    await logAudit({ traceId, action: "registrarSobrevivientesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "registrarSobrevivientesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
