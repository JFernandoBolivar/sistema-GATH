/**
 * Cliente HTTP para Movimientos conectado a las APIs canónicas /api/v1/movimientos/.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export interface MovimientoApiItem {
  id: number;
  empleado_cedula: string;
  codigo_puesto: string;
  tipo_movimiento: string;
  motivo_id: number | null;
  motivo_nombre: string | null;
  denominacion_nombre: string;
  especifica_nombre: string;
  grado_nombre: string | null;
  tipo_nomina_nombre: string;
  estatus_nombre: string;
  tipo_personal_nombre: string | null;
  dependencia_nombre: string | null;
  direccion_general_nombre: string | null;
  direccion_linea_nombre: string | null;
  coordinacion_nombre: string | null;
  fecha_movimiento: string;
  ejecutado_por_id: number;
  ejecutado_por_nombre: string;
}

export const movimientosApi = {
  getHistorialPorEmpleado: (cedula: string) =>
    apiClient.get<MovimientoApiItem[]>(`/api/v1/movimientos/empleado/${cedula}/`),

  getHistorialPorCargo: (codigoPuesto: string) =>
    apiClient.get<MovimientoApiItem[]>(`/api/v1/movimientos/cargo/${codigoPuesto}/`),
};
