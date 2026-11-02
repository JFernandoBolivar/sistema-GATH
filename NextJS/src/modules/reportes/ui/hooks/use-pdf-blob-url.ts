"use client";

import { useEffect, useState } from "react";

/**
 * URL de descarga de un PDF generado en el cliente.
 *
 * Un `blob:` de `URL.createObjectURL` vive hasta que se revoca: si el formulario
 * reemplaza el reporte, lo limpia o se desmonta sin revocarlo, la memoria del
 * navegador retiene el archivo. El hook centraliza ese ciclo de vida (M4):
 * revoca la URL anterior al reemplazarla, al limpiar y al desmontar.
 */
export interface PdfBlobUrl {
  url: string | undefined;
  fijar: (blob: Blob) => void;
  limpiar: () => void;
}

export function usePdfBlobUrl(): PdfBlobUrl {
  const [url, setUrl] = useState<string>();

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  return {
    url,
    fijar: (blob: Blob) => setUrl(URL.createObjectURL(blob)),
    limpiar: () => setUrl(undefined),
  };
}
