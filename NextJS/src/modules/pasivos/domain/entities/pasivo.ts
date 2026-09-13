/**
 * Entidad de Dominio de Pasivos (Regla R1).
 *
 * Alineado a `PasivoSerializer` del backend
 * (`apps/pasivos/presentation/serializers/pasivos_serializers.py`). Un pasivo
 * también es un `Employee` (expediente anidado con la misma forma de
 * `apps/personal` — mismo contrato compartido `expediente_lectura`):
 * `datos_vivienda`, `perfil_salud`, `perfil_fisico`, `formacion_academica`,
 * `contacto_emergencia`, `antecedentes` y `contrato_actual` se pueblan solo en
 * el detalle (`GET /api/v1/pasivos/<cedula>/`).
 *
 * `cargosHistorial` es específico de pasivos (snapshot de los cargos que
 * tenía el empleado al momento del egreso): a diferencia del resto del
 * expediente, el backend ya resuelve el `_nombre` de cada catálogo junto al
 * `_id` (mismo patrón que `CargoAsignacionSerializer` para cargos activos),
 * así que no requiere una llamada a catálogos adicional.
 */

export interface DatosViviendaPasivo {
  estadoId?: number | null;
  municipioId?: number | null;
  parroquiaId?: number | null;
  direccionExacta?: string | null;
  condicionViviendaId?: number | null;
  codigoPostalId?: number | null;
}

export interface PerfilSaludPasivo {
  grupoSanguineoId?: number | null;
  alergias?: number[];
  patologiasCronicas?: number[];
  discapacidades?: number[];
}

export interface PerfilFisicoPasivo {
  tallaCamisaId?: number | null;
  tallaPantalonId?: number | null;
  tallaZapatosId?: number | null;
  tallaChaquetaId?: number | null;
}

export interface FormacionAcademicaPasivo {
  id?: number;
  nivelAcademicoId?: number | null;
  carreraId?: number | null;
  mencionId?: number | null;
  institucionId?: number | null;
}

export interface ContactoEmergenciaPasivo {
  id?: number;
  nombres?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
  relacionId?: number | null;
}

export interface AntecedentePasivo {
  id?: number;
  organismoId?: number | null;
  fechaIngreso?: string | null;
  fechaEgreso?: string | null;
}

export interface ContratoActualPasivo {
  id?: number;
  nContrato?: string | null;
  fechaCulminacion?: string | null;
  politicaId?: number | null;
  estatusId?: number | null;
  esFijo?: boolean;
}

/** Cargo histórico al momento del egreso, con nombre de catálogo ya resuelto por el backend. */
export interface CargoHistorialPasivo {
  codigo: string;
  denominacionCargoId: number;
  denominacionCargoNombre: string;
  denominacionCargoEspecificoId: number;
  denominacionCargoEspecificoNombre: string;
  gradoId?: number | null;
  gradoNombre?: string | null;
  tipoNominaId: number;
  tipoNominaNombre: string;
  tipoPersonalId: number;
  tipoPersonalNombre: string;
  dependenciaId: number;
  dependenciaNombre: string;
  direccionGeneralId?: number | null;
  direccionGeneralNombre?: string | null;
  direccionLineaId?: number | null;
  direccionLineaNombre?: string | null;
  coordinacionId?: number | null;
  coordinacionNombre?: string | null;
  organismoAdscritoId?: number | null;
  organismoAdscritoNombre?: string | null;
}

export interface CatalogoPasivo {
  id: number;
  nombre: string;
}

export interface Pasivo {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  tipoPasivo: string;
  fechaEgreso: string | null;
  resolucion: string | null;
  observaciones: string | null;
  datosVivienda: DatosViviendaPasivo | null;
  perfilSalud: PerfilSaludPasivo | null;
  perfilFisico: PerfilFisicoPasivo | null;
  formacionAcademica: FormacionAcademicaPasivo[];
  contactoEmergencia: ContactoEmergenciaPasivo[];
  antecedentes: AntecedentePasivo[];
  contratoActual: ContratoActualPasivo | null;
  cargosHistorial: CargoHistorialPasivo[];
}
