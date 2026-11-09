import type { SeccionCodigo } from "../entities/solicitud-actualizacion";

/** Tipo de soporte permitido en una sección, tal como lo devuelve el backend (O41). */
export interface TipoSoporteConfigurado {
  codigo: string;
  nombre: string;
  requerido: boolean;
  orden: number;
}

/** Tipos permitidos agrupados por sección: la configuración vive en la base de datos. */
export type TiposSoportePorSeccion = Partial<Record<SeccionCodigo, TipoSoporteConfigurado[]>>;

export function tiposDeSeccion(
  configuracion: TiposSoportePorSeccion | undefined,
  seccion: SeccionCodigo,
): TipoSoporteConfigurado[] {
  return configuracion?.[seccion] ?? [];
}

/** Convierte la lista plana del backend en el mapa que consumen los editores. */
export function agruparTiposSoporte(
  filas: ReadonlyArray<TipoSoporteConfigurado & { seccion: string }>,
): TiposSoportePorSeccion {
  const agrupado: TiposSoportePorSeccion = {};
  for (const fila of filas) {
    const { seccion, ...tipo } = fila;
    const clave = seccion as SeccionCodigo;
    agrupado[clave] = [...(agrupado[clave] ?? []), tipo].sort((a, b) => a.orden - b.orden);
  }
  return agrupado;
}
