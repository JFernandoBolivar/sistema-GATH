/**
 * Casos de uso de autorización del módulo de reportes (R16/D-07): deciden qué
 * puede ver y generar la sesión según sus códigos de permiso, sin mirar el
 * nombre del rol ni asumir el comodín "*".
 */
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import {
  PERMISO_ESTRUCTURA_ORGANIZATIVA,
  PERMISO_REPORTES,
} from "../../domain/value-objects/permisos-reportes";

export function puedeVerReportes(permisos: string[] | null | undefined): boolean {
  return tienePermiso(permisos, PERMISO_REPORTES.ver);
}

export function puedeGenerarReportePdf(permisos: string[] | null | undefined): boolean {
  return tienePermiso(permisos, PERMISO_REPORTES.generarPdf);
}

export function puedeGenerarReporteExcel(permisos: string[] | null | undefined): boolean {
  return tienePermiso(permisos, PERMISO_REPORTES.generarExcel);
}

export function puedeFiltrarEstructuraOrganizativa(
  permisos: string[] | null | undefined,
): boolean {
  return tienePermiso(permisos, PERMISO_ESTRUCTURA_ORGANIZATIVA);
}
