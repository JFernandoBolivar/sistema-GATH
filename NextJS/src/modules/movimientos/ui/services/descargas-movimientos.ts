/**
 * Descarga del historial de movimientos (G6) desde la pantalla.
 *
 * El navegador pide el documento al handler del mismo origen
 * (`/api/movimientos/{pdf|excel}`), que conserva la sesión y devuelve las
 * cabeceras `X-Reporte-*` de truncado. Mismo patrón que el PDF de reportes.
 */
import type { ArchivoDescargado } from "../../domain/value-objects/resultado-historial";
import type { FiltrosMovimiento } from "../../domain/ports/repo-movimientos";
import {
  descargarHistorial,
  type FormatoDescarga,
} from "../../infrastructure/http/movimientos-descargas-api";

function aFiltrosApi(filtros?: FiltrosMovimiento) {
  return {
    cedula: filtros?.cedula,
    codigo_puesto: filtros?.codigoPuesto,
    categoria: filtros?.categoria,
    tipo_movimiento: filtros?.tipoMovimiento,
    fecha_inicio: filtros?.fechaInicio,
    fecha_fin: filtros?.fechaFin,
    gerencia: filtros?.gerencia,
    estatus: filtros?.estatus,
  };
}

export function descargarHistorialMovimientos(
  formato: FormatoDescarga,
  filtros?: FiltrosMovimiento,
): Promise<ArchivoDescargado> {
  return descargarHistorial(formato, aFiltrosApi(filtros));
}
