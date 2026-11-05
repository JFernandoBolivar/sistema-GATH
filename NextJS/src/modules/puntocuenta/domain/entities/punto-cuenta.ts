export interface PuntoCuentaItem {
  id: string;
  numero: string | null;
  anio: number | null;
  secuencia: number | null;
  cargo_id: number;
  cargo_codigo?: string | null;
  cargo_nombre?: string | null;
  empleado_cedula: string;
  empleado_nombre: string | null;
  dependencia_origen_id: number | null;
  dependencia_origen_nombre: string | null;
  dependencia_destino_id: number | null;
  dependencia_destino_nombre: string | null;
  oficina_origen_id?: number | null;
  oficina_origen?: string | null;
  oficina_destino_id?: number | null;
  oficina_destino?: string | null;
  division_origen_id?: number | null;
  division_origen?: string | null;
  division_destino_id?: number | null;
  division_destino?: string | null;
  motivo_id: number | null;
  motivo_nombre: string | null;
  usuario_id: number | null;
  fecha: string;
  documento_generado: boolean;
}

export interface FiltrosPuntoCuenta {
  cedula?: string;
  oficina_id?: number | string;
  fecha_desde?: string;
  fecha_hasta?: string;
}
