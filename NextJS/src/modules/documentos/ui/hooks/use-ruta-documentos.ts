"use client";

import { RUTA_DOCUMENTOS } from "@/shared/lib/administracion-sistema";

/** Ruta canónica compartida por el listado, el editor y las redirecciones heredadas. */
export function useRutaDocumentos(): string {
  return RUTA_DOCUMENTOS;
}
