/**
 * DTOs de Autogestión (Regla R5).
 */
export interface OpcionPreguntaDTO {
  id: number;
  texto: string;
  orden: number;
}

export interface PreguntaCensoDTO {
  id: number;
  enunciado: string;
  tipo: string;
  orden: number;
  activo: boolean;
  validacion: string | null;
  opciones: OpcionPreguntaDTO[];
}

export interface RespuestaCensoDTO {
  id: number;
  preguntaId: number;
  preguntaEnunciado: string;
  empleadoCedula: string;
  opcionId: number | null;
  opcionTexto: string | null;
  respuestaTexto: string;
}

export interface ItemRespuestaInputDTO {
  preguntaId: number;
  opcionId?: number | null;
  respuesta?: string;
}

export interface ReporteDependenciaDTO {
  dependenciaId: number;
  dependencia: string;
  totalEmpleados: number;
  empleadosCensados: number;
}
