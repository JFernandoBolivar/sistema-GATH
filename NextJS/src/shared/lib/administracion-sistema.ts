/**
 * Nombres y rutas de «Administración del sistema» (D9). Un único lugar para el
 * nombre del módulo y sus dos apartados: menú, selector de inicio, títulos y
 * breadcrumb lo consumen; las rutas actuales de usuarios se conservan.
 */
export const NOMBRE_ADMINISTRACION = "Administración del sistema";
export const SECCION_USUARIOS = "Usuarios y roles";
export const SECCION_CONFIGURACION = "Configuración";
export const SECCION_AUDITORIA = "Bitácora de auditoría";

export const RUTA_USUARIOS = "/usuarios";
export const RUTA_CONFIGURACION = "/configuracion";
export const RUTA_PARAMETROS = "/configuracion/parametros";
export const RUTA_VISUAL = "/configuracion/visual";
export const RUTA_REGLAS_CATALOGOS = "/configuracion/reglas-catalogos";
export const RUTA_AUTOGESTION_CONFIG = "/configuracion/autogestion";
export const RUTA_CORREO_ACCESO = "/configuracion/correo-acceso";
/** Ruta canónica del diseñador y el listado de plantillas. */
export const RUTA_DOCUMENTOS = "/documentos/plantillas";
export const RUTA_PUNTO_CUENTA = `${RUTA_DOCUMENTOS}?grupo=punto_cuenta`;
export const RUTA_PROCESO_INGRESO = "/configuracion/proceso-ingreso";
/** La misma pantalla dentro de «Gestión de Trabajadores → Ingreso de personal». */
export const RUTA_PROCESO_INGRESO_PERSONAL = "/personal/ingreso/proceso";
export const RUTA_AUDITORIA = "/auditoria";

export const SECCION_POR_RUTA: Record<string, string> = {
  usuarios: SECCION_USUARIOS,
  configuracion: SECCION_CONFIGURACION,
  auditoria: SECCION_AUDITORIA,
};
