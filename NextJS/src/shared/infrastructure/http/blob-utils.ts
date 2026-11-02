/** Crea una URL de objeto navegable/descargable a partir de un Blob (p. ej. un PDF). */
export function createDownloadUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/** Libera la URL de objeto creada por `createDownloadUrl`. Llamar siempre tras usarla. */
export function revokeDownloadUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/** Dispara la descarga de un Blob en el navegador con el nombre de archivo indicado. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = createDownloadUrl(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  revokeDownloadUrl(url);
}
