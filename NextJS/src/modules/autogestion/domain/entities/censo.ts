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

export interface MetricasCenso {
  totalEmpleadosCensados: number;
  totalRespuestas: number;
  porDependencia: ReporteDependenciaCenso[];
}

/**
 * Consolidado del censo por trabajador y su vivienda.
 *
 * Estos tipos los consumen las pantallas de `app/` (censo y respuestas), que no
 * deben importar tipos de `infrastructure/http`: la página no habla el idioma
 * del transporte. Describen la misma información que devuelve la API.
 */

/** Vivienda declarada en el censo (campos que acepta la API). */
export interface DatosViviendaCenso {
  readonly direccion_exacta?: string;
  readonly estado_id?: number;
  readonly municipio_id?: number;
  readonly parroquia?: number;
  readonly condicion_vivienda_id?: number;
  readonly codigo_postal_id?: number;
}

/** Vivienda tal como la devuelve la consulta (código postal expandido). */
export interface ViviendaCenso extends DatosViviendaCenso {
  readonly codigo_postal?: { codigo?: string } | null;
}

/** Cargo vigente del trabajador censado. */
export interface CargoCenso {
  readonly codigo?: string;
  readonly denominacioncargo?: { cargo?: string } | null;
  readonly Dependencia?: { dependencia: string } | null;
  readonly DireccionGeneral?: { direccion_general: string } | null;
  readonly DireccionLinea?: { direccion_linea: string } | null;
  readonly Coordinacion?: { coordinacion: string } | null;
}

/** Respuesta del trabajador a una pregunta del censo. */
export interface PreguntaRespondidaCenso {
  readonly id: number;
  readonly pregunta: string;
  readonly tipo: string;
  readonly opcion: { id: number; opcion: string } | null;
  readonly respuesta: string;
}

/** Fila del consolidado del censo por trabajador. */
export interface CensoEmpleado {
  readonly id: number;
  readonly cedula: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly fecha_nacimiento: string | null;
  readonly carnet_patria: string | null;
  readonly carnet_patria_serial: string | null;
  readonly cargos: CargoCenso[];
  readonly datos_vivienda: ViviendaCenso | null;
  readonly total_apn: { years: number; months: number; days: number };
  readonly fecha_ingreso_organismo: string | null;
  readonly preguntas: PreguntaRespondidaCenso[];
}
