/**
 * Entidades de Dominio de Cargas Familiares (Regla R1).
 *
 * El mini-expediente (formación académica, perfil de salud, perfil físico)
 * replica el legado (`RAC/models/personal_models.py`: `perfil_salud`,
 * `perfil_fisico`, `formacion_academica` tienen columna `familiar_id` además
 * de `empleado_id`), pero a diferencia de Personal cada sección es UN SOLO
 * objeto por familiar, no un arreglo — el legado (`FamilyCreateSerializer`)
 * nunca permitió múltiples formaciones académicas/perfiles por familiar.
 */
export interface FormacionAcademicaFamiliar {
  nivelAcademicoId?: number | null;
  carreraId?: number | null;
  mencionId?: number | null;
  institucionId?: number | null;
}

export interface PerfilSaludFamiliar {
  grupoSanguineoId?: number | null;
  alergias?: number[];
  patologiasCronicas?: number[];
  discapacidades?: number[];
}

export interface PerfilFisicoFamiliar {
  tallaCamisaId?: number | null;
  tallaPantalonId?: number | null;
  tallaZapatosId?: number | null;
  tallaChaquetaId?: number | null;
}

export interface Familiar {
  id: number;
  empleadoCedula: string;
  cedulaFamiliar: string | null;
  primerNombre: string;
  segundoNombre: string | null;
  primerApellido: string;
  segundoApellido: string | null;
  parentescoId: number;
  parentescoNombre: string;
  fechaNacimiento: string;
  sexoId: number;
  sexoNombre: string;
  mismoEnte: boolean;
  heredero: boolean;
  observaciones: string | null;
  formacionAcademica?: FormacionAcademicaFamiliar | null;
  perfilSalud?: PerfilSaludFamiliar | null;
  perfilFisico?: PerfilFisicoFamiliar | null;
}

export interface DocumentoFamiliar {
  id: number;
  familiarId: number;
  tipoDocumento: string;
  rutaArchivo: string;
  fechaSubida: string;
}
