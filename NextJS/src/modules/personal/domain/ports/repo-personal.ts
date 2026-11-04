/**
 * Puerto del Repositorio de Personal (Reglas R1, R4).
 *
 * El expediente anidado viaja dentro de `GuardarEmpleadoDatos` (escritura de
 * crear/actualizar) y se devuelve poblado en `Empleado` (lectura de detalle).
 */
import type {
  Antecedente,
  CatalogoExpediente,
  ContactoEmergencia,
  Contrato,
  DatosVivienda,
  Empleado,
  FormacionAcademica,
  FormacionComplementaria,
  PerfilFisico,
  PerfilSalud,
} from "../entities/empleado";

export interface FiltrosListadoEmpleado {
  busqueda?: string;
  cedulaidentidad?: string;
  codigo?: string;
  tipo_nomina?: string | number;
}

export interface CatalogosExpediente {
  estados: CatalogoExpediente[];
  municipios: CatalogoExpediente[];
  parroquias: CatalogoExpediente[];
  condicionesVivienda: CatalogoExpediente[];
  codigosPostales: CatalogoExpediente[];
  gruposSanguineos: CatalogoExpediente[];
  nivelesAcademicos: CatalogoExpediente[];
  carreras: CatalogoExpediente[];
  menciones: CatalogoExpediente[];
  instituciones: CatalogoExpediente[];
  capacitaciones: CatalogoExpediente[];
  gruposCapacitacion: CatalogoExpediente[];
  tiposProcedencia: CatalogoExpediente[];
  tiposPrenda: CatalogoExpediente[];
  tallas: CatalogoExpediente[];
  politicas: CatalogoExpediente[];
  alergias: CatalogoExpediente[];
  patologias: CatalogoExpediente[];
  discapacidades: CatalogoExpediente[];
  sexos: CatalogoExpediente[];
  estadosCiviles: CatalogoExpediente[];
  organismos: CatalogoExpediente[];
  nacionalidades: CatalogoExpediente[];
  parentescos: CatalogoExpediente[];
}

export interface GuardarEmpleadoDatos {
  cedula: string;
  nombres: string;
  apellidos: string;
  sexoId: number;
  fechaNacimiento: string;
  correo?: string | null;
  telefonoMovil?: string | null;
  telefonoHabitacion?: string | null;
  estadoCivilId?: number | null;
  nacionalidadId?: number | null;
  carnetPatria?: string | null;
  carnetPatriaSerial?: string | null;
  datosVivienda?: DatosVivienda | null;
  perfilSalud?: PerfilSalud | null;
  perfilFisico?: PerfilFisico | null;
  formacionAcademica?: FormacionAcademica[];
  formacionComplementaria?: FormacionComplementaria[];
  contactoEmergencia?: ContactoEmergencia[];
  antecedentes?: Antecedente[];
  contrato?: Contrato[];
}

export interface PaginacionListado {
  /** Página 1-based (por defecto 1). */
  page?: number;
  /** Registros por página (por defecto 10, tope 50 en el backend). */
  pageSize?: number;
}

export interface PaginaEmpleados {
  items: Empleado[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RepoPersonal {
  listarEmpleados(
    filtros?: FiltrosListadoEmpleado & PaginacionListado,
  ): Promise<PaginaEmpleados>;
  obtenerPorCedula(cedula: string): Promise<Empleado>;
  crearEmpleado(data: GuardarEmpleadoDatos): Promise<Empleado>;
  actualizarEmpleado(cedula: string, data: Partial<GuardarEmpleadoDatos>): Promise<Empleado>;
  listarCatalogosExpediente(): Promise<CatalogosExpediente>;
  /** PDF del expediente generado en backend (ReportLab), reemplaza el render client-side con @react-pdf/renderer. */
  descargarPdf(cedula: string): Promise<Blob>;
}
