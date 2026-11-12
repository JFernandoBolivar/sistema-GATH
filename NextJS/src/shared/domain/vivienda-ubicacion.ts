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

/** Qué bloques de la vivienda se muestran según el país efectivo (propuesto o actual). */
export interface CamposViviendaVisibles {
  /** El país solo se muestra cuando la vivienda está fuera de Venezuela. */
  mostrarPais: boolean;
  /** Ciudad o región sustituye a la geografía venezolana en el exterior. */
  mostrarCiudadRegion: boolean;
  /** Estado, municipio, parroquia y código postal. */
  mostrarUbicacionVenezuela: boolean;
}

/**
 * Regla única de las pantallas de vivienda: fuera de Venezuela se ven país,
 * ciudad o región, dirección y condición; en Venezuela, la geografía nacional
 * (estado, municipio, parroquia y código postal) y nunca ciudad o región.
 */
export function camposViviendaVisibles(
  pais: PaisUbicacion | null | undefined,
  hayVivienda = true,
): CamposViviendaVisibles {
  const venezuela = esViviendaVenezuela(pais, hayVivienda);
  return {
    mostrarPais: !venezuela,
    mostrarCiudadRegion: !venezuela,
    mostrarUbicacionVenezuela: venezuela,
  };
}

/**
 * Interpreta el nombre de un país ya formateado (catálogo). Devuelve `null`
 * mientras el nombre no se pudo resolver («Cargando…», «—» o «Código N»).
 */
export function nombreEsVenezuela(nombre: string | null | undefined): boolean | null {
  const limpio = (nombre ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (!limpio || limpio === "—" || limpio === "-" || limpio.startsWith("CARGANDO")) return null;
  if (/^CODIGO\s+\d+$/.test(limpio)) return null;
  return limpio === "VENEZUELA";
}

