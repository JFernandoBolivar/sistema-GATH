/**
 * Puerto del Repositorio de Carnetización (Reglas R1, R4, O44 - E3).
 */
import type {
  CampoCredencial,
  Carnet,
  CategoriaBiblioteca,
  DatosCarnetEmpleado,
  ElementoBiblioteca,
  EstadisticasCarnet,
  FichaQr,
  PlantillaCarnet,
  PlantillaMotor,
  PreferenciasPrivacidadCarnet,
  TipoCredencial,
} from "../entities/carnet";

export interface CrearPlantillaBorradorInput {
  nombre: string;
  codigo_tipo?: string;
  definicion?: Record<string, unknown>;
  ancho_mm?: number;
  alto_mm?: number;
  orientacion?: "vertical" | "horizontal";
  regla_criterio?: string;
  regla_valor?: string;
  descripcion?: string;
}

export interface RepoCarnetizacion {
  listarCarnets(cedula?: string): Promise<Carnet[]>;
  emitirCarnet(empleadoCedula: string, motivoId: number, observaciones?: string, plantillaId?: string): Promise<Carnet>;
  validarPorHash(securityHash: string): Promise<{ esValido: boolean; mensaje: string; carnet: Carnet | null }>;
  validarPorId(carnetId: number): Promise<{ esValido: boolean; mensaje: string; carnet: Carnet | null }>;
  listarPlantillas(): Promise<PlantillaCarnet[]>;
  crearPlantilla(nombre: string, imagen: File, activar?: boolean): Promise<PlantillaCarnet>;
  activarPlantilla(plantillaId: number | string): Promise<PlantillaCarnet>;
  descargarPdf(carnetId: number): Promise<Blob>;
  revocarCarnet(carnetId: number): Promise<Carnet>;
  obtenerEstadisticas(): Promise<EstadisticasCarnet>;
  obtenerDatosEmpleado(cedula: string): Promise<DatosCarnetEmpleado | null>;

  // Motor de Plantillas y Catálogo (O44 - E3)
  listarTiposCredencial(): Promise<TipoCredencial[]>;
  listarPlantillasMotor(tipo?: string, estado?: string, activas?: boolean): Promise<PlantillaMotor[]>;
  obtenerPlantillaMotor(id: string): Promise<PlantillaMotor>;
  crearPlantillaBorrador(input: CrearPlantillaBorradorInput): Promise<PlantillaMotor>;
  actualizarPlantillaBorrador(id: string, input: Partial<CrearPlantillaBorradorInput>): Promise<PlantillaMotor>;
  publicarPlantilla(id: string, activar?: boolean): Promise<PlantillaMotor>;
  activarPlantillaMotor(id: string): Promise<PlantillaMotor>;
  listarVersionesPlantilla(raizId: string): Promise<PlantillaMotor[]>;
  obtenerPlantillaActiva(tipo?: string, criterio?: string, valor?: string): Promise<PlantillaMotor>;

  // Biblioteca Compartida de Medios (O44 - E4)
  listarBiblioteca(categoria?: string): Promise<ElementoBiblioteca[]>;
  subirElementoBiblioteca(nombre: string, categoria: CategoriaBiblioteca, archivo: File, descripcion?: string): Promise<ElementoBiblioteca>;
  eliminarElementoBiblioteca(id: string): Promise<boolean>;

  // Registro de Campos Autorizados y Personalizados (O44 - E5)
  listarCampos(tipo?: string): Promise<CampoCredencial[]>;
  crearCampoPersonalizado(campo: {
    codigo: string;
    etiqueta: string;
    grupo?: string;
    tipo_credencial?: string;
    sensible?: boolean;
    descripcion?: string;
    valor_ejemplo?: string;
  }): Promise<CampoCredencial>;
  eliminarCampoPersonalizado(codigo: string): Promise<boolean>;

  // QR y Privacidad por Dato (O44 - E9)
  consultarFichaQr(securityHash: string): Promise<FichaQr>;
  consultarSaludEmergencia(securityHash: string): Promise<FichaQr>;
  obtenerPreferenciasPrivacidad(): Promise<PreferenciasPrivacidadCarnet>;
  guardarPreferenciasPrivacidad(preferencias: PreferenciasPrivacidadCarnet): Promise<PreferenciasPrivacidadCarnet>;
}
