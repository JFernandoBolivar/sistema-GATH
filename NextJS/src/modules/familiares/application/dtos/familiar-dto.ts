/**
 * DTOs de Cargas Familiares (Regla R5).
 */
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
}

export interface DocumentoFamiliarDTO {
  id: number;
  familiarId: number;
  tipoDocumento: string;
  rutaArchivo: string;
  fechaSubida: string;
}

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
}
