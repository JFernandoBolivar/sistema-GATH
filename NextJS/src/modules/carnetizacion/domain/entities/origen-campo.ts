/**
 * Origen del dato de un campo personalizado del carnet: lista CERRADA de datos reales del
 * expediente. Es la misma lista que valida el backend (`ORIGENES_CAMPO_PERSONALIZADO`).
 */
export const ORIGENES_CAMPO = [
  { valor: "tipo_sangre", etiqueta: "Tipo de sangre" },
  { valor: "telefono_movil", etiqueta: "Teléfono móvil" },
  { valor: "correo_acceso", etiqueta: "Correo de acceso" },
  { valor: "correo_alternativo", etiqueta: "Correo alternativo" },
  { valor: "fecha_ingreso", etiqueta: "Fecha de ingreso" },
  { valor: "nivel", etiqueta: "Nivel" },
  { valor: "tipo_nomina", etiqueta: "Tipo de nómina" },
  { valor: "sexo", etiqueta: "Sexo" },
  { valor: "fecha_nacimiento", etiqueta: "Fecha de nacimiento" },
  { valor: "nacionalidad", etiqueta: "Nacionalidad" },
] as const;

export type OrigenCampo = (typeof ORIGENES_CAMPO)[number]["valor"];

/** Etiqueta legible del origen; vacío si el campo no tiene origen o no se reconoce. */
export function etiquetaOrigenCampo(origen: string | null | undefined): string {
  return ORIGENES_CAMPO.find((o) => o.valor === origen)?.etiqueta ?? "";
}

/** Un campo personalizado sin origen (anterior a esta función) se imprime vacío. */
export function campoSinOrigen(campo: { es_personalizado: boolean; origen?: string | null }): boolean {
  return campo.es_personalizado && !etiquetaOrigenCampo(campo.origen);
}
