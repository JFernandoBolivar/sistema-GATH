/**
 * Paleta CONATEL viva para los gráficos de pantalla y su captura al PDF.
 * Espejo de `BACKEND/core/infrastructure/pdf/paleta.py`: un solo lugar por
 * lado; ningún componente debe repetir valores hexadecimales sueltos.
 */
export const PALETA_GRAFICOS = {
  azulConatel: "#0B4A9E",
  azulOscuro: "#0A2F66",
  azulIntermedio: "#1A237E",
  azulClaro: "#E8EEF8",
  amarillo: "#D97706",
  dorado: "#F59E0B",
  amarilloSuave: "#FEF3C7",
  teal: "#0E7490",
  violeta: "#6D28D9",
  grisTexto: "#374151",
  grisMuted: "#6B7280",
  grisBorde: "#D5DAE3",
  grisFondo: "#F7F9FC",
  blanco: "#FFFFFF",
} as const;

/** Series en orden de uso (azul institucional primero, acento dorado después). */
export const SERIES_GRAFICOS = [
  PALETA_GRAFICOS.azulConatel,
  PALETA_GRAFICOS.dorado,
  PALETA_GRAFICOS.teal,
  PALETA_GRAFICOS.violeta,
] as const;

export const COLORES_COBERTURA = [
  PALETA_GRAFICOS.azulConatel,
  PALETA_GRAFICOS.amarillo,
] as const;
