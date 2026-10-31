/** Permisos por código del módulo de configuración (D9). */
export const PERMISO_CONFIGURACION = {
  editar: "configuracion.editar",
} as const;

/** Grupos de la pantalla de parámetros, en el orden en que se muestran. */
export const GRUPOS_PARAMETROS = [
  { clave: "notificaciones", etiqueta: "Notificaciones" },
  { clave: "plazos", etiqueta: "Plazos" },
  { clave: "fe_de_vida", etiqueta: "Fe de vida" },
] as const;
