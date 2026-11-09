/**
 * Catálogo de etiquetas legibles en español, agrupación por módulo y severidad
 * semántica para las acciones de la bitácora de auditoría (FIX-DIS4).
 */

export type SeveridadAccion =
  | "creacion"      // Verde: alta, registro, emisión
  | "actualizacion"  // Azul: modificación, cambio
  | "aprobacion"     // Teal/Esmeralda: check, validación, conformidad
  | "advertencia"    // Ámbar: prórroga, devolución, alerta
  | "peligro"        // Rojo: anulación, baja, egreso, rechazo, fallo
  | "consulta";      // Gris/Neutro: consultas, verificaciones públicas, pruebas

export interface DefinicionAccion {
  codigo: string;
  etiqueta: string;
  modulo: string;
  moduloVisible: string;
  severidad: SeveridadAccion;
  descripcion?: string;
}

/**
 * Catálogo canónico de acciones de auditoría en el sistema GATH.
 */
export const CATALOGO_ACCIONES: Record<string, DefinicionAccion> = {
  // === MÓDULO IDENTIDAD Y ACCESO ===
  "identidad.alta_usuario": {
    codigo: "identidad.alta_usuario",
    etiqueta: "Creación de usuario",
    modulo: "identidad",
    moduloVisible: "Identidad y Cuentas",
    severidad: "creacion",
  },
  "identidad.alta_usuario_denegada": {
    codigo: "identidad.alta_usuario_denegada",
    etiqueta: "Alta de usuario rechazada",
    modulo: "identidad",
    moduloVisible: "Identidad y Cuentas",
    severidad: "peligro",
  },
  "identidad.acceso_restablecido": {
    codigo: "identidad.acceso_restablecido",
    etiqueta: "Restablecimiento de contraseña",
    modulo: "identidad",
    moduloVisible: "Identidad y Cuentas",
    severidad: "actualizacion",
  },
  "identidad.estado_cuenta_actualizado": {
    codigo: "identidad.estado_cuenta_actualizado",
    etiqueta: "Cambio de estado de cuenta",
    modulo: "identidad",
    moduloVisible: "Identidad y Cuentas",
    severidad: "actualizacion",
  },
  "identidad.rol_actualizado": {
    codigo: "identidad.rol_actualizado",
    etiqueta: "Asignación de rol de usuario",
    modulo: "identidad",
    moduloVisible: "Identidad y Cuentas",
    severidad: "actualizacion",
  },
  "identidad.permisos_individuales_actualizados": {
    codigo: "identidad.permisos_individuales_actualizados",
    etiqueta: "Permisos individuales actualizados",
    modulo: "identidad",
    moduloVisible: "Identidad y Cuentas",
    severidad: "actualizacion",
  },
  "identidad.matriz_permisos_actualizada": {
    codigo: "identidad.matriz_permisos_actualizada",
    etiqueta: "Matriz de permisos modificada",
    modulo: "identidad",
    moduloVisible: "Identidad y Cuentas",
    severidad: "actualizacion",
  },
  "identidad.matriz_actualizada_por_seed": {
    codigo: "identidad.matriz_actualizada_por_seed",
    etiqueta: "Matriz actualizada por sistema",
    modulo: "identidad",
    moduloVisible: "Identidad y Cuentas",
    severidad: "consulta",
  },
  "identidad.correo_acceso_cambiado": {
    codigo: "identidad.correo_acceso_cambiado",
    etiqueta: "Cambio de correo de acceso",
    modulo: "identidad",
    moduloVisible: "Identidad y Cuentas",
    severidad: "actualizacion",
  },

  // === MÓDULO PERSONAL TRABAJADOR ===
  "personal.crear": {
    codigo: "personal.crear",
    etiqueta: "Registro de trabajador",
    modulo: "personal",
    moduloVisible: "Personal Trabajador",
    severidad: "creacion",
  },
  "personal.editar": {
    codigo: "personal.editar",
    etiqueta: "Actualización de expediente de personal",
    modulo: "personal",
    moduloVisible: "Personal Trabajador",
    severidad: "actualizacion",
  },
  "crear": {
    codigo: "crear",
    etiqueta: "Registro nuevo",
    modulo: "personal",
    moduloVisible: "Personal Trabajador",
    severidad: "creacion",
  },
  "editar": {
    codigo: "editar",
    etiqueta: "Modificación de datos",
    modulo: "personal",
    moduloVisible: "Personal Trabajador",
    severidad: "actualizacion",
  },
  "alterada": {
    codigo: "alterada",
    etiqueta: "Modificación laboral registrada",
    modulo: "personal",
    moduloVisible: "Personal Trabajador",
    severidad: "actualizacion",
  },
  "personal.reporte_error_laboral_creado": {
    codigo: "personal.reporte_error_laboral_creado",
    etiqueta: "Reporte de error laboral creado",
    modulo: "personal",
    moduloVisible: "Personal Trabajador",
    severidad: "advertencia",
  },
  "personal.reporte_error_laboral_atendido": {
    codigo: "personal.reporte_error_laboral_atendido",
    etiqueta: "Reporte de error laboral atendido",
    modulo: "personal",
    moduloVisible: "Personal Trabajador",
    severidad: "aprobacion",
  },

  // === MÓDULO MOVIMIENTOS ===
  "movimientos.registrar": {
    codigo: "movimientos.registrar",
    etiqueta: "Registro de movimiento de personal",
    modulo: "movimientos",
    moduloVisible: "Movimientos",
    severidad: "actualizacion",
  },

  // === MÓDULO PERSONAL PASIVO ===
  "pasivos.pasivo_creado": {
    codigo: "pasivos.pasivo_creado",
    etiqueta: "Registro de personal pasivo",
    modulo: "pasivos",
    moduloVisible: "Personal Pasivo",
    severidad: "creacion",
  },
  "pasivos.pasivo_actualizado": {
    codigo: "pasivos.pasivo_actualizado",
    etiqueta: "Actualización de expediente de pasivo",
    modulo: "pasivos",
    moduloVisible: "Personal Pasivo",
    severidad: "actualizacion",
  },
  "pasivos.alta_sobreviviente": {
    codigo: "pasivos.alta_sobreviviente",
    etiqueta: "Alta de sobreviviente de pensión",
    modulo: "pasivos",
    moduloVisible: "Personal Pasivo",
    severidad: "creacion",
  },
  "pasivo_egresado": {
    codigo: "pasivo_egresado",
    etiqueta: "Egreso formal de pasivo",
    modulo: "pasivos",
    moduloVisible: "Personal Pasivo",
    severidad: "peligro",
  },

  // === MÓDULO FE DE VIDA ===
  "APROBACION_DIRECTA_ADMINISTRADORA": {
    codigo: "APROBACION_DIRECTA_ADMINISTRADORA",
    etiqueta: "Aprobación directa por administradora",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "aprobacion",
  },
  "CHECK_DADO": {
    codigo: "CHECK_DADO",
    etiqueta: "Conformidad otorgada en revisión",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "aprobacion",
  },
  "CHECK_RETIRADO": {
    codigo: "CHECK_RETIRADO",
    etiqueta: "Conformidad retirada",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "advertencia",
  },
  "DEVUELTA": {
    codigo: "DEVUELTA",
    etiqueta: "Solicitud devuelta para corrección",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "advertencia",
  },
  "SOLICITUD_DEVUELTA": {
    codigo: "SOLICITUD_DEVUELTA",
    etiqueta: "Solicitud devuelta para corrección",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "advertencia",
  },
  "ANULADA": {
    codigo: "ANULADA",
    etiqueta: "Solicitud anulada",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "peligro",
  },
  "VENCIDA": {
    codigo: "VENCIDA",
    etiqueta: "Plazo de solicitud vencido",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "peligro",
  },
  "PRORROGA_CONCEDIDA": {
    codigo: "PRORROGA_CONCEDIDA",
    etiqueta: "Prórroga de consignación concedida",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "advertencia",
  },
  "CONSTANCIA_REGENERADA": {
    codigo: "CONSTANCIA_REGENERADA",
    etiqueta: "Constancia de fe de vida regenerada",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "actualizacion",
  },
  "CONSTANCIA_VERIFICADA_PUBLICA": {
    codigo: "CONSTANCIA_VERIFICADA_PUBLICA",
    etiqueta: "Verificación pública de constancia",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "consulta",
  },
  "CORREO_ENVIADO": {
    codigo: "CORREO_ENVIADO",
    etiqueta: "Constancia enviada por correo",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "consulta",
  },
  "COBERTURA_CONSULTADA": {
    codigo: "COBERTURA_CONSULTADA",
    etiqueta: "Consulta de cobertura de pasivos",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "consulta",
  },
  "EVIDENCIA_CONSULTADA": {
    codigo: "EVIDENCIA_CONSULTADA",
    etiqueta: "Consulta de evidencia fotográfica",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "consulta",
  },
  "EVIDENCIA_RECHAZADA_POR_CALIDAD": {
    codigo: "EVIDENCIA_RECHAZADA_POR_CALIDAD",
    etiqueta: "Evidencia rechazada por calidad",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "peligro",
  },
  "PROCESO_EDITADO": {
    codigo: "PROCESO_EDITADO",
    etiqueta: "Período de fe de vida editado",
    modulo: "fe_de_vida",
    moduloVisible: "Fe de Vida",
    severidad: "actualizacion",
  },

  // === MÓDULO CARGA MASIVA ===
  "CARGA_MASIVA_REGISTRO_APLICADO": {
    codigo: "CARGA_MASIVA_REGISTRO_APLICADO",
    etiqueta: "Registro de carga masiva aplicado",
    modulo: "carga_masiva",
    moduloVisible: "Carga Masiva",
    severidad: "creacion",
  },
  "carga_masiva.aplicada": {
    codigo: "carga_masiva.aplicada",
    etiqueta: "Lote de carga masiva aplicado",
    modulo: "carga_masiva",
    moduloVisible: "Carga Masiva",
    severidad: "creacion",
  },
  "carga_masiva.revertida": {
    codigo: "carga_masiva.revertida",
    etiqueta: "Lote de carga masiva revertido",
    modulo: "carga_masiva",
    moduloVisible: "Carga Masiva",
    severidad: "advertencia",
  },
  "carga_masiva.aprobada": {
    codigo: "carga_masiva.aprobada",
    etiqueta: "Lote de carga masiva aprobado",
    modulo: "carga_masiva",
    moduloVisible: "Carga Masiva",
    severidad: "aprobacion",
  },
  "carga_masiva.rechazada": {
    codigo: "carga_masiva.rechazada",
    etiqueta: "Lote de carga masiva rechazado",
    modulo: "carga_masiva",
    moduloVisible: "Carga Masiva",
    severidad: "peligro",
  },

  // === MÓDULO CARNETIZACIÓN ===
  "EMISION": {
    codigo: "EMISION",
    etiqueta: "Emisión de credencial / carnet",
    modulo: "carnetizacion",
    moduloVisible: "Carnetización",
    severidad: "creacion",
  },
  "ESCANEO": {
    codigo: "ESCANEO",
    etiqueta: "Control de acceso - Escaneo válido",
    modulo: "carnetizacion",
    moduloVisible: "Carnetización",
    severidad: "aprobacion",
  },
  "ESCANEO_ANULADO": {
    codigo: "ESCANEO_ANULADO",
    etiqueta: "Control de acceso - Carnet anulado",
    modulo: "carnetizacion",
    moduloVisible: "Carnetización",
    severidad: "peligro",
  },
  "ESCANEO_NO_VALIDO": {
    codigo: "ESCANEO_NO_VALIDO",
    etiqueta: "Control de acceso - Credencial no válida",
    modulo: "carnetizacion",
    moduloVisible: "Carnetización",
    severidad: "peligro",
  },
  "ESCANEO_VENCIDO": {
    codigo: "ESCANEO_VENCIDO",
    etiqueta: "Control de acceso - Credencial vencida",
    modulo: "carnetizacion",
    moduloVisible: "Carnetización",
    severidad: "advertencia",
  },
  "ANULADO_POR_EGRESO": {
    codigo: "ANULADO_POR_EGRESO",
    etiqueta: "Credencial anulada por egreso",
    modulo: "carnetizacion",
    moduloVisible: "Carnetización",
    severidad: "peligro",
  },

  // === MÓDULO PUNTO DE CUENTA ===
  "puntocuenta.configuracion_actualizada": {
    codigo: "puntocuenta.configuracion_actualizada",
    etiqueta: "Configuración de punto de cuenta",
    modulo: "puntocuenta",
    moduloVisible: "Punto de Cuenta",
    severidad: "actualizacion",
  },
  "puntocuenta.generado": {
    codigo: "puntocuenta.generado",
    etiqueta: "Punto de cuenta generado",
    modulo: "puntocuenta",
    moduloVisible: "Punto de Cuenta",
    severidad: "creacion",
  },

  // === MÓDULO CONFIGURACIÓN ===
  "configuracion.parametro_actualizado": {
    codigo: "configuracion.parametro_actualizado",
    etiqueta: "Actualización de parámetro general",
    modulo: "configuracion",
    moduloVisible: "Configuración",
    severidad: "actualizacion",
  },
  "configuracion.imagen_cintillo_subida": {
    codigo: "configuracion.imagen_cintillo_subida",
    etiqueta: "Actualización de cintillo institucional",
    modulo: "configuracion",
    moduloVisible: "Configuración",
    severidad: "actualizacion",
  },
  "configuracion.imagen_cintillo_restaurada": {
    codigo: "configuracion.imagen_cintillo_restaurada",
    etiqueta: "Restauración de cintillo institucional",
    modulo: "configuracion",
    moduloVisible: "Configuración",
    severidad: "actualizacion",
  },
  "configuracion.retencion_aplicada": {
    codigo: "configuracion.retencion_aplicada",
    etiqueta: "Ejecución de política de retención",
    modulo: "configuracion",
    moduloVisible: "Configuración",
    severidad: "advertencia",
  },
  "configuracion.regla_catalogo_actualizada": {
    codigo: "configuracion.regla_catalogo_actualizada",
    etiqueta: "Actualización de regla de catálogo",
    modulo: "configuracion",
    moduloVisible: "Configuración",
    severidad: "actualizacion",
  },
  "configuracion.correo_acceso_politica_actualizada": {
    codigo: "configuracion.correo_acceso_politica_actualizada",
    etiqueta: "Política de correo de acceso actualizada",
    modulo: "configuracion",
    moduloVisible: "Configuración",
    severidad: "actualizacion",
  },
  "configuracion.correo_acceso_aplicado_masivo": {
    codigo: "configuracion.correo_acceso_aplicado_masivo",
    etiqueta: "Aplicación masiva de correos de acceso",
    modulo: "configuracion",
    moduloVisible: "Configuración",
    severidad: "actualizacion",
  },

  // === SISTEMA / AUDITORÍA GENERAL ===
  "CONSULTA_ADMIN": {
    codigo: "CONSULTA_ADMIN",
    etiqueta: "Consulta administrativa",
    modulo: "core",
    moduloVisible: "Sistema",
    severidad: "consulta",
  },
  "APERTURA_MEDICA": {
    codigo: "APERTURA_MEDICA",
    etiqueta: "Consulta de ficha de salud",
    modulo: "core",
    moduloVisible: "Sistema",
    severidad: "consulta",
  },
  "MODIFICAR": {
    codigo: "MODIFICAR",
    etiqueta: "Modificación de registro",
    modulo: "core",
    moduloVisible: "Sistema",
    severidad: "actualizacion",
  },
  "ELIMINAR": {
    codigo: "ELIMINAR",
    etiqueta: "Eliminación de registro",
    modulo: "core",
    moduloVisible: "Sistema",
    severidad: "peligro",
  },
  "probar": {
    codigo: "probar",
    etiqueta: "Verificación técnica de auditoría",
    modulo: "core",
    moduloVisible: "Sistema",
    severidad: "consulta",
  },
};

/**
 * Mapeo de nombres legibles para los módulos del sistema.
 */
export const NOMBRES_MODULOS: Record<string, string> = {
  identidad: "Identidad y Cuentas",
  personal: "Personal Trabajador",
  movimientos: "Movimientos",
  pasivos: "Personal Pasivo",
  fe_de_vida: "Fe de Vida",
  carga_masiva: "Carga Masiva",
  carnetizacion: "Carnetización",
  puntocuenta: "Puntos de Cuenta",
  configuracion: "Configuración del Sistema",
  autogestion: "Autogestión",
  exportaciones: "Exportaciones",
  core: "Sistema",
};

/**
 * Obtiene la etiqueta amigable en español para un código técnico de acción.
 * Si no está registrada en el catálogo, genera un formato legible por palabras.
 */
export function obtenerEtiquetaAccion(codigoAccion: string): string {
  if (!codigoAccion) return "—";
  const def = CATALOGO_ACCIONES[codigoAccion];
  if (def) return def.etiqueta;

  // Fallback seguro legible si llega una acción no catalogada
  const partes = codigoAccion.split(/[._]/);
  return partes
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Obtiene la severidad semántica para un código de acción.
 */
export function obtenerSeveridadAccion(codigoAccion: string): SeveridadAccion {
  return CATALOGO_ACCIONES[codigoAccion]?.severidad ?? "consulta";
}

/**
 * Devuelve las opciones agrupadas por módulo legible listas para el Combobox.
 */
export function obtenerAccionesAgrupadas(accionesDisponibles: string[] = []): {
  modulo: string;
  moduloVisible: string;
  acciones: { codigo: string; etiqueta: string }[];
}[] {
  // Tomamos todas las del catálogo más las disponibles que vengan del backend
  const conjunto = new Set<string>([
    ...Object.keys(CATALOGO_ACCIONES),
    ...accionesDisponibles,
  ]);

  const agrupado: Record<string, { codigo: string; etiqueta: string }[]> = {};

  for (const codigo of conjunto) {
    if (!codigo) continue;
    const def = CATALOGO_ACCIONES[codigo];
    const mod = def?.modulo ?? codigo.split(".")[0] ?? "core";
    const etiqueta = def?.etiqueta ?? obtenerEtiquetaAccion(codigo);

    if (!agrupado[mod]) agrupado[mod] = [];
    agrupado[mod].push({ codigo, etiqueta });
  }

  // Ordenar módulos y acciones alfabéticamente
  return Object.entries(agrupado)
    .map(([modulo, items]) => ({
      modulo,
      moduloVisible: NOMBRES_MODULOS[modulo] || modulo.toUpperCase(),
      acciones: items.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es")),
    }))
    .sort((a, b) => a.moduloVisible.localeCompare(b.moduloVisible, "es"));
}
