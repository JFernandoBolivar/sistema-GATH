"use server";

/**
 * Server Actions del postulante (D-5/D-6). Ninguna recibe un id de expediente: el expediente sale
 * del token de Django que se lee del JWT cifrado en el servidor (Zero-IDOR). Devuelven un resultado
 * con el motivo en español; no lanzan errores al navegador.
 */
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "#/auth";
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import type { MiExpedienteDTO, ResultadoPostulacion, Ventana2DTO } from "../../application/dtos/postulacion-dto";
import {
  cambiarClave,
  catalogosVentana2,
  enviarACaptacion,
  guardarBorrador,
  guardarVentana2,
} from "../../application/use-cases/gestionar-postulacion";
import {
  RUTA_ACCESO_POSTULANTE,
  RUTA_RECIBIDO,
} from "../../domain/acceso-ruta";
import { clavesCoinciden, evaluarClaveNueva } from "../../domain/clave";
import { credencialesPostulanteSchema } from "../../domain/credenciales";
import {
  falloDeCodigoNextAuth,
  mensajeDeAcceso,
  presentarErrorApi,
  type FalloAcceso,
} from "../../domain/errores-acceso";
import { camposFaltantesParaEnviar, ETIQUETA_CAMPO, type ValoresVentana1 } from "../../domain/ventana1";
import { mensajeDeCodigoVentana2, type CatalogosVentana2 } from "../../domain/ventana2";
import { esquemaVentana1 } from "../../ui/schema/schema-ventana1";
import { ErrorPostulacion } from "../http/postulacion-api";
import { repoPostulacionApi } from "../repositories/repo-postulacion-api";
import { leerSesionPostulante } from "../sesion-postulante";

export type ResultadoAcceso = { ok: true } | ({ ok: false } & FalloAcceso & { mensaje: string });

const SIN_SESION = {
  ok: false,
  mensaje: mensajeDeAcceso({ codigo: "SESION_INVALIDA" }),
  codigo: "SESION_INVALIDA",
  sesionCaida: true,
} as const;

function resultadoDeError(e: unknown, porDefecto: string): Extract<ResultadoPostulacion<never>, { ok: false }> {
  if (e instanceof ErrorPostulacion) {
    const p = presentarErrorApi({
      status: e.status,
      codigo: e.codigo,
      bloqueadaHasta: e.bloqueadaHasta,
      mensajeServidor: e.message,
      conErroresDeCampo: !!e.errores,
    });
    const mensaje = e.errores || p.sesionCaida ? p.mensaje : (mensajeDeCodigoVentana2(e.codigo) ?? p.mensaje);
    return {
      ok: false,
      mensaje,
      codigo: e.codigo,
      errores: e.errores,
      faltantes: e.faltantes,
      sesionCaida: p.sesionCaida,
    };
  }
  return { ok: false, mensaje: porDefecto };
}

/** Código que dejó `signIn` (devuelto o lanzado como `AuthError`). */
async function iniciarSesion(cedula: string, password: string): Promise<FalloAcceso | null> {
  try {
    const resultado = (await signIn("postulante", { cedula, password, redirect: false })) as
      | { error?: string; code?: string }
      | string
      | undefined;
    if (resultado && typeof resultado === "object" && resultado.error) {
      return falloDeCodigoNextAuth(resultado.code);
    }
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return falloDeCodigoNextAuth((error as { code?: string }).code);
    }
    return { codigo: "SERVICIO_NO_DISPONIBLE" };
  }
}

export async function iniciarSesionPostulanteAction(raw: {
  cedula: string;
  password: string;
}): Promise<ResultadoAcceso> {
  const validacion = credencialesPostulanteSchema.safeParse(raw);
  const traceId = generateTraceId();
  const inicio = Date.now();
  if (!validacion.success) {
    const fallo: FalloAcceso = { codigo: "CREDENCIALES_INVALIDAS" };
    return { ok: false, ...fallo, mensaje: mensajeDeAcceso(fallo) };
  }
  const fallo = await iniciarSesion(validacion.data.cedula, validacion.data.password);
  await logAudit({
    traceId,
    action: "iniciarSesionPostulanteAction",
    status: fallo ? "FAILED" : "SUCCESS",
    durationMs: Date.now() - inicio,
  });
  if (fallo) return { ok: false, ...fallo, mensaje: mensajeDeAcceso(fallo) };
  return { ok: true };
}

export async function cambiarClaveAction(raw: {
  claveActual: string;
  claveNueva: string;
  confirmacion: string;
}): Promise<ResultadoPostulacion> {
  const [sesion, sesionAuth] = await Promise.all([leerSesionPostulante(), auth()]);
  const cedula = sesionAuth?.user?.cedula ?? "";
  if (!sesion || !cedula) return SIN_SESION;

  if (!raw.claveActual) {
    return { ok: false, mensaje: "Escribe tu contraseña temporal.", errores: { clave_actual: ["Escribe tu contraseña temporal."] } };
  }
  if (!evaluarClaveNueva(raw.claveNueva, { cedula, claveActual: raw.claveActual }).valida) {
    return { ok: false, mensaje: "La contraseña nueva no cumple las reglas.", errores: { clave_nueva: ["No cumple las reglas indicadas."] } };
  }
  if (!clavesCoinciden(raw.claveNueva, raw.confirmacion)) {
    return { ok: false, mensaje: "Las contraseñas no coinciden.", errores: { confirmacion: ["Las contraseñas no coinciden."] } };
  }

  const traceId = generateTraceId();
  const inicio = Date.now();
  try {
    await cambiarClave(repoPostulacionApi, sesion.tokenDjango, raw.claveActual, raw.claveNueva);
  } catch (e) {
    await logAudit({ traceId, action: "cambiarClavePostulanteAction", status: "FAILED", durationMs: Date.now() - inicio });
    return resultadoDeError(e, "No fue posible cambiar la contraseña.");
  }

  // El backend devolvió una sesión nueva y revocó la anterior. Se renueva la de NextAuth entrando de
  // nuevo con la clave nueva dentro del servidor: así el token nuevo se obtiene en `authorize` y nunca
  // se acepta un token enviado desde el navegador.
  const fallo = await iniciarSesion(cedula, raw.claveNueva);
  await logAudit({
    traceId,
    action: "cambiarClavePostulanteAction",
    status: fallo ? "FAILED" : "SUCCESS",
    durationMs: Date.now() - inicio,
  });
  if (fallo) {
    return {
      ok: false,
      mensaje: "Tu contraseña se cambió. Ingresa de nuevo con la contraseña nueva.",
      sesionCaida: true,
    };
  }
  return { ok: true, datos: undefined };
}

function validarFormulario(valores: ValoresVentana1) {
  const parsed = esquemaVentana1.safeParse(valores);
  if (parsed.success) return { ok: true as const, valores: parsed.data as ValoresVentana1 };
  const errores: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) (errores[issue.path.join(".")] ??= []).push(issue.message);
  return { ok: false as const, errores };
}

export async function guardarBorradorAction(
  valores: ValoresVentana1,
): Promise<ResultadoPostulacion<MiExpedienteDTO>> {
  const sesion = await leerSesionPostulante();
  if (!sesion) return SIN_SESION;
  const validado = validarFormulario(valores);
  if (!validado.ok) {
    return { ok: false, mensaje: "Revisa los campos marcados.", errores: validado.errores };
  }
  const traceId = generateTraceId();
  const inicio = Date.now();
  try {
    const datos = await guardarBorrador(repoPostulacionApi, sesion.tokenDjango, validado.valores);
    await logAudit({ traceId, action: "guardarBorradorPostulanteAction", status: "SUCCESS", durationMs: Date.now() - inicio });
    return { ok: true, datos };
  } catch (e) {
    await logAudit({ traceId, action: "guardarBorradorPostulanteAction", status: "FAILED", durationMs: Date.now() - inicio });
    return resultadoDeError(e, "No fue posible guardar tu avance.");
  }
}

/** Guarda el borrador, envía a Captación, cierra la sesión y lleva a la pantalla de «Recibido». */
export async function enviarACaptacionAction(valores: ValoresVentana1): Promise<ResultadoPostulacion> {
  const sesion = await leerSesionPostulante();
  if (!sesion) return SIN_SESION;

  const faltan = camposFaltantesParaEnviar(valores);
  if (faltan.length > 0) {
    return {
      ok: false,
      mensaje: `Falta completar: ${faltan.map((c) => (ETIQUETA_CAMPO[c] ?? c).toLowerCase()).join(", ")}.`,
    };
  }
  const validado = validarFormulario(valores);
  if (!validado.ok) {
    return { ok: false, mensaje: "Revisa los campos marcados.", errores: validado.errores };
  }

  const traceId = generateTraceId();
  const inicio = Date.now();
  let numero = "";
  try {
    await guardarBorrador(repoPostulacionApi, sesion.tokenDjango, validado.valores);
    const envio = await enviarACaptacion(repoPostulacionApi, sesion.tokenDjango);
    numero = envio.expediente.numero;
  } catch (e) {
    await logAudit({ traceId, action: "enviarCaptacionPostulanteAction", status: "FAILED", durationMs: Date.now() - inicio });
    return resultadoDeError(e, "No fue posible enviar tu información.");
  }
  await logAudit({ traceId, action: "enviarCaptacionPostulanteAction", status: "SUCCESS", durationMs: Date.now() - inicio });

  // El token de Django ya no vale: se cierra también la sesión de NextAuth.
  await signOut({ redirect: false });
  redirect(numero ? `${RUTA_RECIBIDO}?n=${encodeURIComponent(numero)}` : RUTA_RECIBIDO);
}

// --- Ventana 2 (postulante con el ingreso aprobado) ---

/** Guarda una o varias secciones del borrador de la Ventana 2 (las enviadas reemplazan a las guardadas). */
export async function guardarVentana2Action(cuerpo: Record<string, unknown>): Promise<ResultadoPostulacion<Ventana2DTO>> {
  const sesion = await leerSesionPostulante();
  if (!sesion) return SIN_SESION;
  const traceId = generateTraceId();
  const inicio = Date.now();
  try {
    const datos = await guardarVentana2(repoPostulacionApi, sesion.tokenDjango, cuerpo);
    await logAudit({ traceId, action: "guardarVentana2PostulanteAction", status: "SUCCESS", durationMs: Date.now() - inicio });
    return { ok: true, datos };
  } catch (e) {
    await logAudit({ traceId, action: "guardarVentana2PostulanteAction", status: "FAILED", durationMs: Date.now() - inicio });
    return resultadoDeError(e, "No fue posible guardar tu avance.");
  }
}

/** Catálogos del formulario; con `estadoId` y `municipioId` trae también los municipios y las parroquias. */
export async function catalogosVentana2Action(
  estadoId?: number,
  municipioId?: number,
): Promise<ResultadoPostulacion<CatalogosVentana2>> {
  const sesion = await leerSesionPostulante();
  if (!sesion) return SIN_SESION;
  try {
    return { ok: true, datos: await catalogosVentana2(repoPostulacionApi, sesion.tokenDjango, estadoId, municipioId) };
  } catch (e) {
    return resultadoDeError(e, "No fue posible cargar las opciones.");
  }
}

/** Envía la Ventana 2 a revisión final, cierra la sesión y lleva a «Recibimos tus datos». */
export async function enviarVentana2Action(): Promise<ResultadoPostulacion> {
  const sesion = await leerSesionPostulante();
  if (!sesion) return SIN_SESION;
  const traceId = generateTraceId();
  const inicio = Date.now();
  let numero = "";
  try {
    const envio = await enviarACaptacion(repoPostulacionApi, sesion.tokenDjango);
    numero = envio.expediente.numero;
  } catch (e) {
    await logAudit({ traceId, action: "enviarVentana2PostulanteAction", status: "FAILED", durationMs: Date.now() - inicio });
    return resultadoDeError(e, "No fue posible enviar tus datos.");
  }
  await logAudit({ traceId, action: "enviarVentana2PostulanteAction", status: "SUCCESS", durationMs: Date.now() - inicio });
  await signOut({ redirect: false });
  const parametros = new URLSearchParams({ v: "2" });
  if (numero) parametros.set("n", numero);
  redirect(`${RUTA_RECIBIDO}?${parametros.toString()}`);
}

/** «Salir»: cierra la sesión del postulante y vuelve a su pantalla de acceso. */
export async function cerrarSesionPostulanteAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect(RUTA_ACCESO_POSTULANTE);
}
