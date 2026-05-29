// constants/file-config.ts

// Definimos los límites manualmente en Bytes para no usar la librería 'bytes'
// 1 KB = 1024 B | 1 MB = 1024 KB
export const FILE_LIMITS = {
  AVATAR: 2 * 1024 * 1024, // 2MB
  DOCUMENTS: 5 * 1024 * 1024, // 5MB
  LABELS: {
    AVATAR: "2 MB",
    DOCUMENTS: "5 MB",
  },
};

/**
 * Función global para convertir bytes a formato legible.
 * Usa un array de sufijos y logaritmos para determinar la unidad.
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  // Calculamos el índice del array 'sizes' usando logaritmos
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * Validador de peso sin dependencias
 */
export const validateWeight = (sizeInBytes: number, limitInBytes: number) => {
  return {
    isValid: sizeInBytes <= limitInBytes,
    formattedSize: formatBytes(sizeInBytes),
    limitText: formatBytes(limitInBytes),
  };
};
