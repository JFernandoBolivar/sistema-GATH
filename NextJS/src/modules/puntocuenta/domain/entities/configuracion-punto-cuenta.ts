export interface FirmaItem {
  cargo: string;
  nombre: string;
}

export interface ProcesosHabilitados {
  cambio_oficina: boolean;
  cambio_nivel: boolean;
  cambio_division: boolean;
  cambio_cargo_misma_oficina: boolean;
  egreso_activo: boolean;
  pase_a_pasivo: boolean;
  encargaduria_prestamo: boolean;
  cambio_estatus: boolean;
}

export interface ConfiguracionPuntoCuenta {
  id?: string;
  generar: boolean;
  procesos_habilitados: ProcesosHabilitados;
  titulo: string;
  encabezado: string;
  cuerpo: string;
  firmas: FirmaItem[];
  mostrar_nivel: boolean;
  version: number;
  actualizado_por_id?: number | null;
  updated_at?: string | null;
}
