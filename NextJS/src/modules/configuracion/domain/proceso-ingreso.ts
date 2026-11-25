/**
 * Proceso de ingreso (M-2): textos y reglas de presentación de la pantalla de configuración.
 * Los valores y su validación salen del backend (parámetros); aquí solo se explican en lenguaje claro.
 */
import { CLAVES_PROCESO_INGRESO, SECCION_PROCESO_INGRESO } from "./value-objects/claves-parametros";
import type { ParametroDTO } from "./entities/parametro";

export const AVISO_EXPEDIENTES_EN_CURSO = "Los cambios aplican a los expedientes nuevos; los que están en curso siguen su camino.";

export interface CasillaProceso {
  clave: string;
  titulo: string;
  /** Qué pasa mientras está activa. */
  siActiva: string;
  /** Qué pasa si se desactiva. */
  siInactiva: string;
}

/** Las tres casillas del proceso, en el orden en que ocurren. */
export const CASILLAS_PROCESO: readonly CasillaProceso[] = [
  {
    clave: CLAVES_PROCESO_INGRESO.psicofisicoObligatorio,
    titulo: "Test psicofísico obligatorio",
    siActiva: "Captación no puede continuar con un expediente sin el resultado y el informe del test psicofísico.",
    siInactiva: "Captación puede continuar sin registrar el test psicofísico.",
  },
  {
    clave: CLAVES_PROCESO_INGRESO.requierePresupuesto,
    titulo: "Revisión de Presupuesto en el sistema",
    siActiva: "El expediente pasa por Presupuesto, que reserva el puesto y declara la disponibilidad presupuestaria.",
    siInactiva:
      "Captación reservará el puesto vacante y generará el Punto de Cuenta. La revisión presupuestaria se hace fuera del sistema.",
  },
  {
    clave: CLAVES_PROCESO_INGRESO.requiereDireccionGeneral,
    titulo: "Aprobación de Dirección General en el sistema",
    siActiva: "La Dirección General aprueba o rechaza el ingreso dentro del sistema.",
    siInactiva:
      "Captación generará el Punto de Cuenta para imprimirlo y firmarlo en físico, y registrará la aprobación con la fecha de la firma y, si lo desea, el PDF firmado escaneado.",
  },
];

/** Parámetros de la sección «Proceso de ingreso», tal como los entrega el backend. */
export function parametrosDelProceso(parametros: readonly ParametroDTO[]): ParametroDTO[] {
  return parametros.filter((p) => p.seccion === SECCION_PROCESO_INGRESO);
}

export interface CambioProceso {
  parametro: ParametroDTO;
  anterior: string;
  nuevo: string;
}

/** Cambios pendientes: los borradores que difieren del valor guardado. */
export function cambiosPendientes(parametros: readonly ParametroDTO[], borrador: Readonly<Record<string, string>>): CambioProceso[] {
  return parametros
    .filter((p) => borrador[p.clave] !== undefined && borrador[p.clave].trim() !== p.valor)
    .map((p) => ({ parametro: p, anterior: p.valor, nuevo: borrador[p.clave].trim() }));
}

export type EtapaRuta = { id: string; etiqueta: string; enSistema: boolean };

/** Camino resultante del expediente según las casillas (para el resumen visual). */
export function rutaDelProceso(requierePresupuesto: boolean, requiereDireccion: boolean): EtapaRuta[] {
  return [
    { id: "captacion", etiqueta: "Captación", enSistema: true },
    { id: "presupuesto", etiqueta: "Presupuesto", enSistema: requierePresupuesto },
    { id: "direccion", etiqueta: "Dirección General", enSistema: requiereDireccion },
    { id: "aprobado", etiqueta: "Aprobado", enSistema: true },
  ];
}
