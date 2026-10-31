/**
 * Casos de uso de autorización del módulo de movimientos (D-07/R16): deciden
 * qué puede consultar y exportar la sesión según sus códigos de permiso, sin
 * mirar el nombre del rol ni asumir el comodín "*".
 */
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import { PERMISO_MOVIMIENTOS } from "../../domain/value-objects/permisos-movimientos";

export function puedeVerMovimientos(permisos: string[] | null | undefined): boolean {
  return tienePermiso(permisos, PERMISO_MOVIMIENTOS.ver);
}

export function puedeExportarMovimientosPdf(
  permisos: string[] | null | undefined,
): boolean {
  return tienePermiso(permisos, PERMISO_MOVIMIENTOS.exportarPdf);
}

export function puedeExportarMovimientosExcel(
  permisos: string[] | null | undefined,
): boolean {
  return tienePermiso(permisos, PERMISO_MOVIMIENTOS.exportarExcel);
}
