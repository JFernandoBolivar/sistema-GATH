import type { ProcesoPlantilla } from "../entities/plantilla";

/** Prefijo con el que el catálogo del diseñador identifica los procesos del Punto de Cuenta. */
export const PREFIJO_PROCESO_PUNTO_CUENTA = "punto_cuenta:";
/** El ingreso por postulación emite su Punto de Cuenta dentro del flujo: no se apaga desde la configuración. */
export const PROCESO_INGRESO_POSTULACION = "ingreso_postulacion";

export interface ProcesoPuntoCuenta {
  /** Clave de `procesos_habilitados` en la API de configuración. */
  clave: string;
  /** Código completo del catálogo de documentos (`punto_cuenta:cambio_oficina`). */
  codigo: string;
  /** «Cambio de oficina» (sin el prefijo «Punto de Cuenta: »). */
  etiqueta: string;
  descripcion: string;
  /** Siempre activo: su interruptor se muestra bloqueado y encendido. */
  siempreActivo: boolean;
}

/** Clave de configuración de un proceso del catálogo; los ajenos al Punto de Cuenta se ignoran. */
export function claveConfiguracion(proceso: string): string {
  return proceso.startsWith(PREFIJO_PROCESO_PUNTO_CUENTA)
    ? proceso.slice(PREFIJO_PROCESO_PUNTO_CUENTA.length)
    : proceso;
}

export function etiquetaCortaProceso(etiqueta: string): string {
  const [, corta] = etiqueta.split(": ", 2);
  return (corta ?? etiqueta).trim();
}

/** Los procesos del grupo «Punto de Cuenta» listos para el panel de interruptores. */
export function procesosPuntoCuenta(procesos: readonly ProcesoPlantilla[]): ProcesoPuntoCuenta[] {
  return procesos
    .filter((p) => p.grupo === "punto_cuenta" && p.codigo.startsWith(PREFIJO_PROCESO_PUNTO_CUENTA))
    .map((p) => {
      const clave = claveConfiguracion(p.codigo);
      return {
        clave,
        codigo: p.codigo,
        etiqueta: etiquetaCortaProceso(p.etiqueta),
        descripcion: p.descripcion,
        siempreActivo: clave === PROCESO_INGRESO_POSTULACION,
      };
    });
}
