/**
 * Estado del expediente en lenguaje claro, línea de pasos y cuenta regresiva de la ventana.
 */

export const ESTADOS_EDITABLES: ReadonlySet<string> = new Set([
  "EN_CAPTURA",
  "EN_CORRECCION_DATOS",
]);

export type TonoEstado = "info" | "exito" | "atencion";

export interface DescripcionEstado {
  etiqueta: string;
  explicacion: string;
  tono: TonoEstado;
  /** Paso de la línea de pasos (0 = completar datos). */
  paso: number;
}

export const PASOS_POSTULACION = [
  "Completa tus datos",
  "Revisión de Captación",
  "Evaluación",
  "Resultado",
] as const;

const DESCRIPCIONES: Record<string, DescripcionEstado> = {
  PRE_REGISTRADO: {
    etiqueta: "Registrado",
    explicacion: "Captación ya te registró. Completa tus datos para que revisemos tu postulación.",
    tono: "info",
    paso: 0,
  },
  EN_CAPTURA: {
    etiqueta: "En captura",
    explicacion: "Estás completando tus datos. Puedes guardar tu avance y seguir después.",
    tono: "info",
    paso: 0,
  },
  EN_CORRECCION_DATOS: {
    etiqueta: "Por corregir",
    explicacion: "Captación te pidió ajustar algunos datos. Revisa la nota y vuelve a enviar.",
    tono: "atencion",
    paso: 0,
  },
  ENVIADO_CAPTACION: {
    etiqueta: "Enviado a Captación",
    explicacion: "Captación está revisando tu información. Te contactará pronto.",
    tono: "info",
    paso: 1,
  },
  RECHAZADO_CAPTACION: {
    etiqueta: "No continúa",
    explicacion: "Captación revisó tu información y tu postulación no continúa.",
    tono: "atencion",
    paso: 3,
  },
  EN_PRESUPUESTO: { etiqueta: "En evaluación", explicacion: "Tu postulación está siendo evaluada.", tono: "info", paso: 2 },
  EN_CORRECCION_CARGO: { etiqueta: "En evaluación", explicacion: "Tu postulación está siendo evaluada.", tono: "info", paso: 2 },
  DIFERIDO_PRESUPUESTO: { etiqueta: "En espera", explicacion: "Tu postulación quedó en espera. Captación te avisará.", tono: "atencion", paso: 2 },
  EN_DIRECCION_GENERAL: { etiqueta: "En evaluación", explicacion: "Tu postulación está siendo evaluada.", tono: "info", paso: 2 },
  RECHAZADO_DIRECCION: { etiqueta: "No continúa", explicacion: "Tu postulación no continúa.", tono: "atencion", paso: 3 },
  APROBADO: { etiqueta: "Aprobado", explicacion: "Tu postulación fue aprobada. Captación te dirá los próximos pasos.", tono: "exito", paso: 3 },
  CONSOLIDANDO: { etiqueta: "Completando expediente", explicacion: "Captación te pedirá los documentos finales.", tono: "info", paso: 3 },
  EN_REVISION_FINAL: { etiqueta: "Revisión final", explicacion: "Estamos haciendo la revisión final de tu expediente.", tono: "info", paso: 3 },
  LISTO_PARA_ASIGNAR: { etiqueta: "Listo para asignar", explicacion: "Tu expediente está completo.", tono: "exito", paso: 3 },
  CONTRATADO: { etiqueta: "Contratado", explicacion: "Bienvenido a CONATEL.", tono: "exito", paso: 3 },
  EXPIRADO: { etiqueta: "Plazo vencido", explicacion: "El plazo para completar tus datos venció. Comunícate con Captación.", tono: "atencion", paso: 0 },
  DESISTIDO: { etiqueta: "Desistido", explicacion: "Esta postulación fue cerrada.", tono: "atencion", paso: 3 },
};

export function describirEstado(estado: string): DescripcionEstado {
  return (
    DESCRIPCIONES[estado] ?? {
      etiqueta: estado,
      explicacion: "Captación te informará cualquier novedad.",
      tono: "info",
      paso: 1,
    }
  );
}

export function puedeEditar(estado: string): boolean {
  return ESTADOS_EDITABLES.has(estado);
}

export type Urgencia = "tranquilo" | "pronto" | "urgente" | "vencida";

export interface CuentaRegresiva {
  vencida: boolean;
  urgencia: Urgencia;
  texto: string;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Cuenta regresiva amable hacia `venceEl` (ISO). */
export function cuentaRegresiva(venceEl: string | null, ahora: Date): CuentaRegresiva | null {
  if (!venceEl) return null;
  const fin = new Date(venceEl).getTime();
  if (Number.isNaN(fin)) return null;
  const restanteMs = fin - ahora.getTime();
  if (restanteMs <= 0) {
    return {
      vencida: true,
      urgencia: "vencida",
      texto: "El plazo terminó. Comunícate con Captación para que te habiliten uno nuevo.",
    };
  }
  const minutos = Math.floor(restanteMs / 60_000);
  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  const mins = minutos % 60;

  if (dias >= 1) {
    const resto = horas > 0 ? ` y ${plural(horas, "hora", "horas")}` : "";
    return {
      vencida: false,
      urgencia: dias >= 3 ? "tranquilo" : "pronto",
      texto: `Te quedan ${plural(dias, "día", "días")}${resto} para completar tus datos.`,
    };
  }
  if (horas >= 1) {
    const resto = mins > 0 ? ` y ${plural(mins, "minuto", "minutos")}` : "";
    return {
      vencida: false,
      urgencia: "urgente",
      texto: `Te quedan ${plural(horas, "hora", "horas")}${resto}. Conviene enviar hoy.`,
    };
  }
  return {
    vencida: false,
    urgencia: "urgente",
    texto: `Te quedan menos de ${plural(Math.max(1, mins + 1), "minuto", "minutos")}. Envía tus datos ya.`,
  };
}

/** Fecha larga en hora de Venezuela, p. ej. «sábado, 21 de noviembre de 2026, 14:30». */
export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "long",
    timeStyle: "short",
    hour12: false,
    timeZone: "America/Caracas",
  }).format(fecha);
}
