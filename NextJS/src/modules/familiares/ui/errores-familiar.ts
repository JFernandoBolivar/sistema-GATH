/**
 * Ruta del API -> campo del formulario del familiar (QA 2026-11-04).
 * Sin entrada aquí, `aplicarErroresServidor` prueba el nombre tal cual y su
 * versión camelCase (`primer_nombre` -> `primerNombre`), que cubre casi todo.
 */
export const MAPA_ERRORES_FAMILIAR: Record<string, string> = {
  empleado_cedula: "empleadoCedula",
  cedula_familiar: "cedulaFamiliar",
  "formacion_academica.nivel_academico_id": "formacionAcademica.nivelAcademicoId",
  "formacion_academica.carrera_id": "formacionAcademica.carreraId",
  "formacion_academica.mencion_id": "formacionAcademica.mencionId",
  "formacion_academica.institucion_id": "formacionAcademica.institucionId",
};
