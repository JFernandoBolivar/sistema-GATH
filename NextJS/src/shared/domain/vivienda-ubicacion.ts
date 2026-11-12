/**
 * Reglas compartidas de la ubicación de una vivienda (fe de vida y solicitud de actualización).
 * El país decide qué ubicación se pide; la geografía venezolana depende en cascada.
 */

/** Campos de ubicación que solo existen para una vivienda en Venezuela. */
export const CAMPOS_UBICACION_VENEZUELA = [
  "estado_id",
  "municipio_id",
  "parroquia_id",
  "codigo_postal_id",
] as const;

/** Campos que se vacían al cambiar un campo padre (estado → municipio → parroquia). */
const DEPENDIENTES: Record<string, readonly string[]> = {
  estado_id: ["municipio_id", "parroquia_id", "codigo_postal_id"],
  municipio_id: ["parroquia_id"],
};

/** País de residencia: `esVenezuela` indefinido se trata como Venezuela. */
export interface PaisUbicacion {
  es_venezuela?: boolean | null;
}

/**
 * F2-16: sin país resuelto no se asume Venezuela; solo un expediente sin vivienda
 * usa el país por defecto del sistema.
 */
export function esViviendaVenezuela(
  pais: PaisUbicacion | null | undefined,
  hayVivienda: boolean,
): boolean {
  return pais ? pais.es_venezuela !== false : !hayVivienda;
}

/** Campos que deben vaciarse cuando cambia `campoCambiado` (cambiar el país a uno extranjero vacía la geografía). */
export function camposAVaciar(campoCambiado: string, nuevoPaisEsVenezuela?: boolean): string[] {
  if (campoCambiado === "pais_id") {
    // Un país extranjero deja sin efecto la geografía venezolana; si pasa a Venezuela, hay que elegirla de nuevo.
    return nuevoPaisEsVenezuela === undefined ? [] : [...CAMPOS_UBICACION_VENEZUELA];
  }
  return [...(DEPENDIENTES[campoCambiado] ?? [])];
}
