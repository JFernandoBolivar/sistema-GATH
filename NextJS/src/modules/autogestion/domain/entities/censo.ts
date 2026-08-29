/**
 * Entidades de Dominio de Autogestión y Censo (Regla R1).
 *
 * Alineado a `PreguntaEncuestaSerializer`/`RespuestaEncuestaSerializer`
 * reales del backend (Fase 1 del plan de reparación): el censo es un
 * cuestionario dinámico de preguntas/opciones, no un formulario fijo de
 * campos de vivienda/vehículo/tallas — ese modelo era inventado.
 */
export interface OpcionPreguntaCenso {
  id: number;
  texto: string;
  orden: number;
}

export interface PreguntaCenso {
  id: number;
  enunciado: string;
  tipo: string;
  orden: number;
  activo: boolean;
  validacion: string | null;
  opciones: OpcionPreguntaCenso[];
}

export interface RespuestaCenso {
  id: number;
  preguntaId: number;
  preguntaEnunciado: string;
  empleadoCedula: string;
  opcionId: number | null;
  opcionTexto: string | null;
  respuestaTexto: string;
}

export interface ItemRespuestaCenso {
  preguntaId: number;
  opcionId?: number | null;
  respuesta?: string;
}

export interface ReporteDependenciaCenso {
  dependenciaId: number;
  dependencia: string;
  totalEmpleados: number;
  empleadosCensados: number;
}
