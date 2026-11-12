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
  // Perfil de salud (el grupo sanguíneo es obligatorio en alta y edición).
  "perfil_salud.grupo_sanguineo_id": "perfilSalud.grupoSanguineoId",
  "perfil_salud.alergias": "perfilSalud.alergias",
  "perfil_salud.patologias_cronicas": "perfilSalud.patologiasCronicas",
  "perfil_salud.discapacidades": "perfilSalud.discapacidades",
  perfil_salud: "perfilSalud",
  // Perfil físico (tallas).
  "perfil_fisico.talla_camisa_id": "perfilFisico.tallaCamisaId",
  "perfil_fisico.talla_pantalon_id": "perfilFisico.tallaPantalonId",
  "perfil_fisico.talla_zapatos_id": "perfilFisico.tallaZapatosId",
  "perfil_fisico.talla_chaqueta_id": "perfilFisico.tallaChaquetaId",
  perfil_fisico: "perfilFisico",
};
