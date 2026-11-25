/**
 * Configuración operativa del Punto de Cuenta (procesos habilitados).
 * El contenido y las firmas viven en las plantillas del diseñador de documentos.
 */
export interface ConfiguracionPuntoCuenta {
  id: string | null;
  /** Interruptor general: apagado, ninguna operación emite Punto de Cuenta. */
  generar: boolean;
  procesos_habilitados: Record<string, boolean>;
  version: number;
  actualizado_por_id: number | null;
  updated_at: string | null;
}

export interface CambiosConfiguracionPuntoCuenta {
  generar?: boolean;
  procesos_habilitados?: Record<string, boolean>;
}
