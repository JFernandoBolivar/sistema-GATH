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
  carnetPatria?: string | null;
  datosVivienda?: DatosVivienda | null;
  perfilSalud?: PerfilSalud | null;
  perfilFisico?: PerfilFisico | null;
  formacionAcademica?: FormacionAcademica[];
  formacionComplementaria?: FormacionComplementaria[];
  contactoEmergencia?: ContactoEmergencia[];
  antecedentes?: Antecedente[];
  contrato?: Contrato[];
}

export interface RepoPersonal {
  listarEmpleados(filtros?: FiltrosListadoEmpleado): Promise<Empleado[]>;
  obtenerPorCedula(cedula: string): Promise<Empleado>;
  crearEmpleado(data: GuardarEmpleadoDatos): Promise<Empleado>;
  actualizarEmpleado(cedula: string, data: Partial<GuardarEmpleadoDatos>): Promise<Empleado>;
  listarCatalogosExpediente(): Promise<CatalogosExpediente>;
}
