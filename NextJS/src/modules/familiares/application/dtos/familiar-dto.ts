/**
 * DTOs de Cargas Familiares (Regla R5).
 *
 * `formacionAcademica`/`perfilSalud`/`perfilFisico` son el mini-expediente
 * del familiar (paridad con `FamilyCreateSerializer` del legado): a
 * diferencia de Personal, cada sección es UN SOLO objeto opcional, no un
 * arreglo.
 */
export interface FormacionAcademicaFamiliarDTO {
  nivelAcademicoId?: number | null;
  carreraId?: number | null;
  mencionId?: number | null;
  institucionId?: number | null;
}

export interface PerfilSaludFamiliarDTO {
  grupoSanguineoId?: number | null;
  alergias?: number[];
  patologiasCronicas?: number[];
  discapacidades?: number[];
}

export interface PerfilFisicoFamiliarDTO {
  tallaCamisaId?: number | null;
  tallaPantalonId?: number | null;
  tallaZapatosId?: number | null;
  tallaChaquetaId?: number | null;
}

export interface FamiliarDTO {
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
  formacionAcademica?: FormacionAcademicaFamiliarDTO | null;
  perfilSalud?: PerfilSaludFamiliarDTO | null;
  perfilFisico?: PerfilFisicoFamiliarDTO | null;
}

export interface DocumentoFamiliarDTO {
  id: number;
  familiarId: number;
  tipoDocumento: string;
  rutaArchivo: string;
  fechaSubida: string;
}

export interface CatalogoFamiliarDTO {
  id: number;
  nombre: string;
  codigo?: string | null;
  categoriaId?: number | null;
  categoriaNombre?: string | null;
  tipoPrendaId?: number | null;
  tipoPrendaNombre?: string | null;
  regionId?: number | null;
  regionCodigo?: string | null;
  regionDescripcion?: string | null;
}

export interface CatalogosFamiliarDTO {
  parentescos: CatalogoFamiliarDTO[];
  sexos: CatalogoFamiliarDTO[];
  nivelesAcademicos: CatalogoFamiliarDTO[];
  carreras: CatalogoFamiliarDTO[];
  menciones: CatalogoFamiliarDTO[];
  instituciones: CatalogoFamiliarDTO[];
  tiposPrenda: CatalogoFamiliarDTO[];
  tallas: CatalogoFamiliarDTO[];
  gruposSanguineos: CatalogoFamiliarDTO[];
  alergias: CatalogoFamiliarDTO[];
  patologias: CatalogoFamiliarDTO[];
  discapacidades: CatalogoFamiliarDTO[];
}

/** Fallback si `getCatalogosFamiliarAction` falla (p. ej. sesión expirada). */
export const CATALOGOS_FAMILIAR_VACIOS: CatalogosFamiliarDTO = {
  parentescos: [],
  sexos: [],
  nivelesAcademicos: [],
  carreras: [],
  menciones: [],
  instituciones: [],
  tiposPrenda: [],
  tallas: [],
  gruposSanguineos: [],
  alergias: [],
  patologias: [],
  discapacidades: [],
};

export interface GuardarFamiliarInputDTO {
  empleadoCedula: string;
  cedulaFamiliar?: string | null;
  primerNombre: string;
  segundoNombre?: string | null;
  primerApellido: string;
  segundoApellido?: string | null;
  parentescoId: number;
  fechaNacimiento: string;
  sexoId: number;
  mismoEnte: boolean;
  heredero: boolean;
  observaciones?: string | null;
  formacionAcademica?: FormacionAcademicaFamiliarDTO | null;
  perfilSalud?: PerfilSaludFamiliarDTO | null;
  perfilFisico?: PerfilFisicoFamiliarDTO | null;
}
