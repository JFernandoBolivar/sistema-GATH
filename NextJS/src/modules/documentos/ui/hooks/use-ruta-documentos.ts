"use client";

import { usePathname } from "next/navigation";
import { RUTA_DOCUMENTOS } from "@/shared/lib/administracion-sistema";

/** Ruta de las plantillas dentro de «Gestión de Trabajadores → Ingreso de personal». */
export const RUTA_DOCUMENTOS_INGRESO = "/personal/ingreso/plantillas";

/**
 * Las plantillas se abren en dos sitios (Configuración y Gestión de Trabajadores →
 * Ingreso de personal). Los enlaces internos (volver, abrir, duplicar) deben quedarse
 * en el sitio desde el que se entró.
 */
export function useRutaDocumentos(): string {
  const pathname = usePathname() ?? "";
  return pathname.startsWith(RUTA_DOCUMENTOS_INGRESO) ? RUTA_DOCUMENTOS_INGRESO : RUTA_DOCUMENTOS;
}
