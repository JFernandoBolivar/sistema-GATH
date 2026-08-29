/**
 * Entidades de Dominio de Cargas Familiares (Regla R1).
 */
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
}

export interface DocumentoFamiliar {
  id: number;
  familiarId: number;
  tipoDocumento: string;
  rutaArchivo: string;
  fechaSubida: string;
}
