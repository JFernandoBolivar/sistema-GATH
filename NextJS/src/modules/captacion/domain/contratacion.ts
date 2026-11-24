/** Contratación (promoción atómica LISTO_PARA_ASIGNAR -> CONTRATADO): resultado, textos y errores. */

export interface CuentaContratacion {
  creada: boolean;
  reactivada: boolean;
  motivo: string;
  correo: string | null;
  correoAlternativo: string | null;
  diasVigenciaClaveInicial: number | null;
  entrega: string | null;
}

export interface ResultadoContratacion {
  employeeId: string;
  cedula: string;
  esReingreso: boolean;
  puesto: { id: string; codigo: string };
  familiaresCopiados: number;
  cuenta: CuentaContratacion;
}

/** Destino de la acción de contratar en `acciones[]`. */
export const DESTINO_CONTRATADO = "CONTRATADO";

const AVISO_RRHH_CORREO = "Se avisó a RRHH para que gestione el correo institucional con Tecnología.";

/** Qué explica la cuenta tras contratar, según `cuenta.motivo`. */
export function textoCuenta(c: CuentaContratacion): { titulo: string; detalle: string; tono: "exito" | "atencion" | "info" } {
  if (c.creada) {
    return {
      titulo: "Cuenta de acceso creada",
      detalle:
        c.entrega ||
        `La cuenta se creó${c.correo ? ` con el correo ${c.correo}` : ""}. La contraseña inicial es la cédula${c.diasVigenciaClaveInicial ? ` y vence en ${c.diasVigenciaClaveInicial} días` : ""}.`,
      tono: "exito",
    };
  }
  if (c.reactivada) {
    return { titulo: "Cuenta reactivada", detalle: "Era un reingreso: se reactivó la cuenta de acceso que ya tenía.", tono: "exito" };
  }
  switch (c.motivo) {
    case "sin_correo_institucional":
      return {
        titulo: "La cuenta aún no se crea",
        detalle: `La cuenta se creará cuando RRHH asigne el correo institucional.${c.correoAlternativo ? ` Mientras tanto queda registrado el correo personal ${c.correoAlternativo}.` : ""} ${AVISO_RRHH_CORREO}`,
        tono: "atencion",
      };
    case "sin_correo":
      return {
        titulo: "La cuenta aún no se crea",
        detalle: `El trabajador no tiene ningún correo registrado. Cuando RRHH registre su correo institucional se podrá crear la cuenta. ${AVISO_RRHH_CORREO}`,
        tono: "atencion",
      };
    case "ya_existia":
      return { titulo: "Ya tenía cuenta", detalle: "El trabajador ya tenía una cuenta de acceso: no hizo falta crear otra.", tono: "info" };
    default:
      return {
        titulo: "Cuenta de acceso",
        detalle: c.motivo ? `No se creó la cuenta (${c.motivo.replaceAll("_", " ")}). Revísalo en la ficha del trabajador.` : "No se creó una cuenta nueva.",
        tono: "info",
      };
  }
}

const ERRORES: Record<string, string> = {
  PUESTO_NO_DISPONIBLE: "El puesto reservado ya no está disponible. No se hizo ningún cambio: revise la reserva con Presupuesto.",
  TRANSICION_NO_PERMITIDA: "El expediente ya no está en un estado que permita contratar. Recargue la página.",
  EXPEDIENTE_FINAL: "Este expediente ya está cerrado.",
  SIN_PERMISO: "No tiene permiso para contratar a este postulante.",
  EMPLEADO_ACTIVO: "Esta persona ya figura como trabajador activo. No se puede contratar de nuevo.",
  EMPLEADO_INVALIDO: "La ficha existente del trabajador no permite el reingreso. Revísela en Personal.",
  FAMILIAR_INVALIDO: "Hay un familiar con datos inválidos. Devuelva el expediente al postulante para corregirlo.",
  DATOS_INSUFICIENTES: "Faltan datos del expediente para crear la ficha del trabajador.",
  USUARIO_SIN_CUENTA: "Su usuario no tiene una cuenta de personal asociada para registrar la contratación.",
};

/** Mensaje claro para un código de error de la contratación; si no se conoce, el del servidor. */
export function mensajeErrorContratacion(codigo: string | undefined, mensajeServidor: string): string {
  return (codigo && ERRORES[codigo]) || mensajeServidor || "No fue posible contratar al postulante.";
}

/** Ruta de la ficha del trabajador (consulta de Personal con la cédula). */
export function rutaFichaTrabajador(cedula: string): string {
  return `/personal/consultar?cedula=${encodeURIComponent(cedula)}`;
}

/** Qué va a pasar al confirmar (para el diálogo previo). */
export function resumenAntesDeContratar(puestoCodigo?: string): string[] {
  return [
    "Se creará la ficha del trabajador con los datos del expediente (o se reutilizará la existente si es un reingreso).",
    `Se asignará el puesto${puestoCodigo ? ` ${puestoCodigo}` : " reservado"} y se registrará el movimiento de ingreso.`,
    "Se copiarán sus familiares, vivienda, salud y tallas.",
    "Se creará su cuenta de acceso si ya tiene correo institucional.",
    "El expediente pasará a «Contratado»: no se puede deshacer.",
  ];
}
