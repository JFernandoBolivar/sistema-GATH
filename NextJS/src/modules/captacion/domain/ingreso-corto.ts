/**
 * Flujo de ingreso sin Presupuesto y/o sin Dirección General (M-5).
 *
 * Las reglas de la máquina de estados NO viven aquí: qué se puede hacer sale de `acciones[]` del backend. Aquí solo
 * está lo que la pantalla necesita para explicarlo: el paso a paso, los textos y la validación de los formularios.
 */
import type { Puesto, PuntoCuenta, Reserva } from "@/modules/presupuesto/domain/solicitud";
import type { AccionExpediente } from "./expediente";
import { formatearFecha, formatearFechaHora } from "./formato";

export type { Puesto, Reserva };

/** Punto de Cuenta de ingreso tal como lo informa el detalle de Captación. */
export interface PuntoCuentaCaptacion extends PuntoCuenta {
  puestoId: number | null;
  /** La aprobación se firmó en papel y Captación la registró con la fecha de la firma. */
  aprobadoFueraSistema: boolean;
  /** AAAA-MM-DD (día de la firma). */
  fechaFirma: string | null;
  registradoPorNombre: string;
  tienePdfFirmado: boolean;
  pdfFirmadoTamano: number | null;
}

export const CODIGO_RESERVAR = "reservar_puesto";
export const CODIGO_LIBERAR = "liberar_reserva";
export const CODIGO_GENERAR_PUNTO_CUENTA = "generar_punto_cuenta";
export const CODIGO_REGISTRAR_APROBACION = "registrar_aprobacion";
export const CODIGO_ADJUNTAR_FIRMADO = "adjuntar_punto_cuenta_firmado";

export interface FlujoIngreso {
  requierePresupuesto: boolean;
  requiereDireccionGeneral: boolean;
}

/** Hay un tramo del ingreso que se hace fuera del sistema (flujo corto). */
export function esFlujoCorto(f: FlujoIngreso): boolean {
  return !f.requierePresupuesto || !f.requiereDireccionGeneral;
}

/** Estados posteriores a la aprobación del ingreso. */
const ESTADOS_APROBADO_O_POSTERIOR: ReadonlySet<string> = new Set([
  "APROBADO",
  "CONSOLIDANDO",
  "EN_REVISION_FINAL",
  "LISTO_PARA_ASIGNAR",
  "CONTRATADO",
]);

/** Estados en los que el paso a paso tiene sentido (Captación reserva, genera, registra o espera la decisión). */
const ESTADOS_DEL_PASO_A_PASO: ReadonlySet<string> = new Set(["ENVIADO_CAPTACION", "EN_DIRECCION_GENERAL", "APROBADO"]);

/** El paso a paso se muestra solo con flujo corto y mientras el trámite está en esta etapa. */
export function muestraPasoAPaso(flujo: FlujoIngreso, estado: string): boolean {
  return esFlujoCorto(flujo) && ESTADOS_DEL_PASO_A_PASO.has(estado);
}

export type EstadoPaso = "hecho" | "pendiente" | "bloqueado";

export interface PasoIngreso {
  id: "reserva" | "punto_cuenta" | "aprobacion" | "presupuesto" | "direccion";
  numero: number;
  titulo: string;
  estado: EstadoPaso;
  descripcion: string;
}

/** Reserva que cuenta como hecha: ACTIVA (o ya consumida por la asignación) y vigente. */
export function reservaVigente(reserva: Reserva | null): boolean {
  return reserva !== null && reserva.estado === "ACTIVA" && reserva.vigente;
}

const accionDe = (acciones: readonly AccionExpediente[], codigo: string) => acciones.find((a) => a.codigo === codigo);

type EntradaPasos = {
  flujo: FlujoIngreso;
  estado: string;
  reserva: Reserva | null;
  puntoCuenta: PuntoCuentaCaptacion | null;
  acciones: readonly AccionExpediente[];
};

/** «Aprobado fuera del sistema · firma del dd/mm/aaaa». */
export function textoAprobacionFueraDelSistema(p: Pick<PuntoCuentaCaptacion, "fechaFirma">): string {
  return `Aprobado fuera del sistema · firma del ${formatearFechaDia(p.fechaFirma)}`;
}

/** Día AAAA-MM-DD → dd/mm/aaaa (sin pasar por zonas horarias). */
export function formatearFechaDia(dia: string | null | undefined): string {
  if (!dia) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : formatearFecha(dia);
}

/**
 * El camino del expediente según `flujo`:
 * - sin Presupuesto: 1. Reservar puesto, 2. Generar Punto de Cuenta, 3. Registrar aprobación (sin Dirección General)
 *   o 3. Aprobación de Dirección General (que decide en el sistema);
 * - con Presupuesto y sin Dirección General: 1. Presupuesto emite el Punto de Cuenta, 2. Registrar aprobación.
 */
export function pasosIngresoCorto(d: EntradaPasos): PasoIngreso[] {
  const { flujo, estado, reserva, puntoCuenta, acciones } = d;
  const conReserva = reservaVigente(reserva);
  const aprobado = ESTADOS_APROBADO_O_POSTERIOR.has(estado) || (puntoCuenta?.aprobadoFueraSistema ?? false);
  const pasos: PasoIngreso[] = [];

  if (flujo.requierePresupuesto) {
    pasos.push({
      id: "presupuesto",
      numero: 1,
      titulo: "Presupuesto emite el Punto de Cuenta",
      estado: puntoCuenta ? "hecho" : "pendiente",
      descripcion: puntoCuenta ? `Emitido: ${puntoCuenta.numero}` : "Presupuesto reserva el puesto y emite el Punto de Cuenta",
    });
  } else {
    pasos.push({
      id: "reserva",
      numero: 1,
      titulo: "Reservar puesto",
      estado: conReserva || puntoCuenta ? "hecho" : "pendiente",
      descripcion:
        conReserva || puntoCuenta
          ? `Reservado: ${reserva?.puesto?.codigo ?? "puesto"}${reserva?.venceEl && !puntoCuenta ? ` · vence el ${formatearFecha(reserva.venceEl)}` : ""}`
          : reserva && reserva.estado === "ACTIVA"
            ? "La reserva venció: elija el puesto de nuevo"
            : "Elija un puesto vacante para el postulante",
    });
    const generar = accionDe(acciones, CODIGO_GENERAR_PUNTO_CUENTA);
    pasos.push({
      id: "punto_cuenta",
      numero: 2,
      titulo: "Generar Punto de Cuenta",
      estado: puntoCuenta ? "hecho" : !conReserva || generar?.bloqueada ? "bloqueado" : "pendiente",
      descripcion: puntoCuenta
        ? `Generado: ${puntoCuenta.numero}`
        : !conReserva
          ? "Primero debe reservar el puesto"
          : generar?.bloqueada
            ? generar.motivoBloqueo
            : flujo.requiereDireccionGeneral
              ? "Todo listo: genérelo y se envía a Dirección General"
              : "Todo listo: genérelo para imprimirlo y firmarlo",
    });
  }

  const n = pasos.length + 1;
  if (flujo.requiereDireccionGeneral) {
    pasos.push({
      id: "direccion",
      numero: n,
      titulo: "Aprobación de Dirección General",
      estado: aprobado ? "hecho" : estado === "EN_DIRECCION_GENERAL" ? "pendiente" : "bloqueado",
      descripcion: aprobado
        ? "Aprobado por la Dirección General"
        : estado === "EN_DIRECCION_GENERAL"
          ? "En espera de la decisión de Dirección General"
          : "Primero genere el Punto de Cuenta",
    });
  } else {
    const registrar = accionDe(acciones, CODIGO_REGISTRAR_APROBACION);
    pasos.push({
      id: "aprobacion",
      numero: n,
      titulo: "Registrar aprobación",
      estado: aprobado ? "hecho" : puntoCuenta && !registrar?.bloqueada ? "pendiente" : "bloqueado",
      descripcion:
        aprobado && puntoCuenta?.aprobadoFueraSistema
          ? textoAprobacionFueraDelSistema(puntoCuenta)
          : aprobado
            ? "Aprobado"
            : puntoCuenta
              ? "Imprima y firme el Punto de Cuenta; registre la fecha de la firma"
              : "Primero genere el Punto de Cuenta",
    });
  }
  return pasos;
}

// --- Aprobación fuera del sistema (formulario) ---
export const MAX_BYTES_PDF_FIRMADO = 10 * 1024 * 1024;

/** Fecha de hoy (AAAA-MM-DD) en hora de Venezuela: tope de la fecha de la firma. */
export function hoyEnVenezuela(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(ahora);
}

export interface ValoresAprobacion {
  fechaFirma: string;
  pdfFirmado: File | null;
}

/** Valida el PDF opcional: tipo, vacío y tamaño. */
export function validarPdfFirmado(pdf: File | null): string | null {
  if (!pdf) return null;
  const esPdf = pdf.type === "application/pdf" || pdf.name.toLowerCase().endsWith(".pdf");
  if (!esPdf) return "El Punto de Cuenta firmado debe ser un archivo PDF.";
  if (pdf.size === 0) return "El archivo está vacío.";
  if (pdf.size > MAX_BYTES_PDF_FIRMADO) return "El archivo supera los 10 MB.";
  return null;
}

/** Errores por campo (vacío = válido); el backend vuelve a validar. */
export function validarAprobacion(v: ValoresAprobacion, hoy: string = hoyEnVenezuela()): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!v.fechaFirma) errores.fechaFirma = "Indique la fecha en que se firmó el Punto de Cuenta.";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(v.fechaFirma) || Number.isNaN(Date.parse(v.fechaFirma))) errores.fechaFirma = "La fecha no es válida.";
  else if (v.fechaFirma > hoy) errores.fechaFirma = "La fecha de la firma no puede ser futura.";
  const errorPdf = validarPdfFirmado(v.pdfFirmado);
  if (errorPdf) errores.pdfFirmado = errorPdf;
  return errores;
}

/** Vence la reserva: «vence el dd/mm/aaaa, hh:mm». */
export function textoVencimiento(reserva: Reserva): string {
  return `vence el ${formatearFechaHora(reserva.venceEl)}`;
}
