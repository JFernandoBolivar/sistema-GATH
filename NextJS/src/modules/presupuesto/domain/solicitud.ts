/**
 * Tipos y reglas de presentación de Presupuesto (E-1 a E-5), compartidos con Dirección General (E-6).
 *
 * Las reglas de la máquina de estados NO viven aquí: las acciones salen del backend (`acciones[]`).
 * Aquí solo se calcula la guía de pasos (hecho/pendiente) a partir de lo que el servidor ya informa.
 */
import type { AccionExpediente, HitoHistorial, PropuestaCargo } from "@/modules/captacion/domain/expediente";

export type { AccionExpediente, HitoHistorial };

// --- Bandeja ---
export type PestanaPresupuesto = "por_atender" | "diferidos" | "en_correccion" | "todos";

export interface DefinicionPestana<Id extends string> {
  id: Id;
  etiqueta: string;
  /** Estados que filtra la pestaña (vacío = usar `vista`). */
  estados: string[];
  /** Vista del backend cuando no hay estados. */
  vista?: string;
}

export const PESTANAS_PRESUPUESTO: DefinicionPestana<PestanaPresupuesto>[] = [
  { id: "por_atender", etiqueta: "Por atender", estados: ["EN_PRESUPUESTO"] },
  { id: "diferidos", etiqueta: "Diferidos", estados: ["DIFERIDO_PRESUPUESTO"] },
  { id: "en_correccion", etiqueta: "En corrección de cargo", estados: ["EN_CORRECCION_CARGO"] },
  { id: "todos", etiqueta: "Todos", estados: [], vista: "todos" },
];

export interface FilaArea {
  id: string;
  numero: string;
  estado: string;
  ultimoCambio: string | null;
  esReingreso: boolean;
  pendiente: boolean;
  postulante: { cedula: string; nombres: string; apellidos: string };
  cargoTexto: string;
  oficinaTexto: string;
  diferidoVenceEl: string | null;
  reservaPuestoId: number | null;
  reservaVenceEl: string | null;
  tieneConstancia: boolean;
  puntoCuentaNumero: string | null;
  puntoCuentaEstado: string | null;
}

export interface PaginaArea {
  resultados: FilaArea[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

export interface FiltrosArea {
  estados: string[];
  vista?: string;
  q?: string;
  desde?: string;
  hasta?: string;
  pagina: number;
  tamano: number;
}

// --- Detalle ---
export interface NombreRef {
  id: number | null;
  nombre: string;
}

export interface Puesto {
  id: number;
  codigo: string;
  vacante: boolean;
  cargo: NombreRef;
  cargoEspecifico: NombreRef;
  tipoNomina: NombreRef;
  dependencia: NombreRef;
  direccionGeneral: NombreRef;
  direccionLinea: NombreRef;
  coordinacion: NombreRef;
}

export interface Reserva {
  id: string;
  puestoId: number;
  estado: string;
  reservadoPor: string;
  reservadoEl: string | null;
  venceEl: string | null;
  vigente: boolean;
  puesto: Puesto | null;
}

export interface Constancia {
  referencia: string;
  observaciones: string;
  fecha: string | null;
  declaradoPorCedula: string;
  declaradoPorNombre: string;
  tieneAdjunto: boolean;
  adjuntoTamano: number | null;
}

export interface PuntoCuenta {
  id: string;
  numero: string;
  estado: string;
  referenciaConstancia: string;
  emitidoPor: string;
  emitidoEl: string | null;
  decididoPor: string;
  decididoEl: string | null;
  tieneDocumento: boolean;
}

export interface PropuestaConNombres extends PropuestaCargo {
  nombres: Record<string, string>;
}

export interface DetalleArea {
  expediente: {
    id: string;
    numero: string;
    estado: string;
    fechaApertura: string | null;
    fechaCierre: string | null;
    observaciones: string;
    esReingreso: boolean;
    reservaVenceEl: string | null;
    diferidoVenceEl: string | null;
    propuesta: PropuestaConNombres;
  };
  postulante: { id: string; cedula: string; nombres: string; apellidos: string; esReingreso: boolean };
  reserva: Reserva | null;
  constancia: Constancia | null;
  puntoCuenta: PuntoCuenta | null;
  documentos: { puntoCuenta: string | null; constanciaAdjunto: string | null };
  historial: HitoHistorial[];
  acciones: AccionExpediente[];
  capacidades: { puedeReservar: boolean; puedeDeclararDisponibilidad: boolean };
}

// --- Vacantes ---
export interface FiltrosVacantes {
  cargo?: number;
  oficina?: number;
  dependencia?: number;
  direccionLinea?: number;
  coordinacion?: number;
  q?: string;
  pagina: number;
  tamano: number;
}

export interface FilaVacante extends Puesto {
  reservaPropia: boolean;
}

export interface PaginaVacantes {
  resultados: FilaVacante[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
  deLaPropuesta: boolean;
  reserva: Reserva | null;
}

// --- Constancia (formulario) ---
export interface DatosConstancia {
  referencia: string;
  observaciones: string;
  adjunto: File | null;
}

export const MAX_BYTES_ADJUNTO = 10 * 1024 * 1024;
export const MAX_REFERENCIA = 100;
export const MAX_OBSERVACIONES = 2000;

/** Devuelve los errores por campo (vacío = válido); el backend vuelve a validar. */
export function validarConstancia(v: DatosConstancia): Record<string, string> {
  const errores: Record<string, string> = {};
  const referencia = v.referencia.trim();
  if (!referencia) errores.referencia = "Indique la referencia (partida u oficio).";
  else if (referencia.length > MAX_REFERENCIA) errores.referencia = `La referencia admite hasta ${MAX_REFERENCIA} caracteres.`;
  if (v.observaciones.trim().length > MAX_OBSERVACIONES) errores.observaciones = `Las observaciones admiten hasta ${MAX_OBSERVACIONES} caracteres.`;
  if (v.adjunto) {
    const esPdf = v.adjunto.type === "application/pdf" || v.adjunto.name.toLowerCase().endsWith(".pdf");
    if (!esPdf) errores.adjunto = "El adjunto debe ser un archivo PDF.";
    else if (v.adjunto.size > MAX_BYTES_ADJUNTO) errores.adjunto = "El adjunto supera los 10 MB.";
    else if (v.adjunto.size === 0) errores.adjunto = "El archivo está vacío.";
  }
  return errores;
}

// --- Guía de pasos ---
export type EstadoPaso = "hecho" | "pendiente" | "bloqueado" | "actual" | "fuera_sistema";

export interface PasoGuia {
  id: "reserva" | "constancia" | "punto_cuenta";
  numero: number;
  titulo: string;
  estado: EstadoPaso;
  /** Una línea que dice qué falta o qué ya está. */
  descripcion: string;
}

/** Reserva que cuenta como hecha: ACTIVA (la LIBERADA/VENCIDA/CONSUMIDA no sirve para emitir). */
export function reservaVigente(reserva: Reserva | null): boolean {
  return reserva !== null && reserva.estado === "ACTIVA" && reserva.vigente;
}

/**
 * Los tres pasos de Presupuesto, con su estado:
 * 1. Reservar puesto  2. Declarar disponibilidad  3. Emitir Punto de Cuenta.
 * El paso 3 está «bloqueado» mientras falte alguno de los dos anteriores.
 */
export function pasosGuia(d: Pick<DetalleArea, "reserva" | "constancia" | "puntoCuenta">): PasoGuia[] {
  const conReserva = reservaVigente(d.reserva);
  const conConstancia = d.constancia !== null;
  const emitido = d.puntoCuenta !== null;
  const faltan = [!conReserva ? "reservar el puesto" : "", !conConstancia ? "declarar la disponibilidad" : ""].filter(Boolean);
  return [
    {
      id: "reserva",
      numero: 1,
      titulo: "Reservar puesto",
      estado: conReserva ? "hecho" : "pendiente",
      descripcion: conReserva
        ? `Reservado: ${d.reserva?.puesto?.codigo ?? "puesto"}`
        : d.reserva && d.reserva.estado === "ACTIVA"
          ? "La reserva venció: elija el puesto de nuevo"
          : "Elija un puesto vacante para el postulante",
    },
    {
      id: "constancia",
      numero: 2,
      titulo: "Declarar disponibilidad",
      estado: conConstancia ? "hecho" : "pendiente",
      descripcion: conConstancia ? `Constancia ${d.constancia?.referencia}` : "Registre la referencia de la constancia presupuestaria",
    },
    {
      id: "punto_cuenta",
      numero: 3,
      titulo: "Emitir Punto de Cuenta",
      estado: emitido ? "hecho" : faltan.length > 0 ? "bloqueado" : "pendiente",
      descripcion: emitido
        ? `Emitido: ${d.puntoCuenta?.numero}`
        : faltan.length > 0
          ? `Primero debe ${faltan.join(" y ")}`
          : "Todo listo: puede emitirlo",
    },
  ];
}

export const ESTADOS_PUNTO_CUENTA: Record<string, { etiqueta: string; tono: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  EMITIDO: { etiqueta: "Emitido, por decidir", tono: "info" },
  FIRMADO: { etiqueta: "Aprobado y firmado", tono: "success" },
  RECHAZADO: { etiqueta: "Rechazado", tono: "danger" },
};

export function describirPuntoCuenta(estado: string) {
  return ESTADOS_PUNTO_CUENTA[estado] ?? { etiqueta: estado, tono: "neutral" as const };
}

/** Nombre del cargo y de la oficina propuestos, con el texto libre como respaldo. */
export function cargoPropuesto(p: PropuestaConNombres): string {
  return p.nombres.cargo || p.cargoTexto || "Sin cargo propuesto";
}

export function oficinaPropuesta(p: PropuestaConNombres): string {
  const partes = [p.nombres.direccion_general, p.nombres.direccion_linea, p.nombres.coordinacion, p.nombres.dependencia].filter(Boolean);
  return partes.length > 0 ? partes.join(" › ") : p.oficinaTexto || "Sin oficina propuesta";
}

export interface DatosTransicionArea {
  destino: string;
  motivo?: string;
}

export type { ResultadoAccion } from "@/modules/captacion/domain/expediente";

export interface OpcionFiltro {
  id: number;
  nombre: string;
}

/** Valores distintos (id y nombre) de una columna de puestos, para armar un filtro desplegable. */
export function opcionesDeFiltro(
  filas: readonly Puesto[],
  campo: "cargo" | "dependencia" | "direccionLinea" | "coordinacion",
): OpcionFiltro[] {
  const vistos = new Map<number, string>();
  for (const f of filas) {
    const r = f[campo];
    if (r.id !== null && r.nombre) vistos.set(r.id, r.nombre);
  }
  return [...vistos.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export { motivoDeEntrada } from "@/modules/captacion/domain/motivo-entrada";

/** Estado en el que Presupuesto puede reservar, declarar y emitir. */
export const ESTADO_EDITABLE_PRESUPUESTO = "EN_PRESUPUESTO";
