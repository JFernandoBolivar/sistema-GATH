/** Claves de parámetros que la UI necesita reconocer (D9). */
export const CLAVE_FE_DE_VIDA_RECORDATORIOS = "fe_de_vida.dias_recordatorio";
export const CLAVE_GENERAR_PUNTOS_CUENTA = "puntocuenta.generar";
export const CLAVE_CARNETIZACION_MI_CARNET_ALCANCE = "carnetizacion.mi_carnet_alcance";
export const CLAVE_CARNETIZACION_MI_CARNET_USUARIOS = "carnetizacion.mi_carnet_usuarios";

/** O12: solicitudes de actualización por condición. */
export const CLAVES_AUTOGESTION = {
  activosHabilitado: "autogestion.activos_habilitado",
  activosSecciones: "autogestion.activos_secciones",
  pasivosHabilitado: "autogestion.pasivos_habilitado",
  pasivosSecciones: "autogestion.pasivos_secciones",
} as const;

/** Ruta de la pantalla de configuración de solicitudes por condición. */
export const RUTA_AUTOGESTION_CONDICION = "/configuracion/autogestion";


/** Parámetros del proceso de ingreso (M-1/M-2): pantalla propia en Configuración. */
export const SECCION_PROCESO_INGRESO = "proceso_ingreso";
export const CLAVES_PROCESO_INGRESO = {
  requierePresupuesto: "captacion.requiere_presupuesto",
  requiereDireccionGeneral: "captacion.requiere_direccion_general",
  psicofisicoObligatorio: "captacion.psicofisico_obligatorio",
  vigenciaReserva: "captacion.vigencia_reserva_puesto_dias",
} as const;
