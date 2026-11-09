/**
 * Dominio de Carga Masiva de Personal (O28-F1, F2, F3, F4, FIX-CARGA1).
 * Entidades y tipos compartidos para plantillas, análisis, historial y aplicación.
 */

export type EstadoCarga =
  | "ANALIZADA"
  | "APLICADA"
  | "PENDIENTE_APROBACION"
  | "RECHAZADA"
  | "REVERTIDA"
  | "ERROR";

export type EstadoFila =
  | "NUEVO"
  | "ACTUALIZAR"
  | "SIN_CAMBIOS"
  | "ADVERTENCIA"
  | "REQUIERE_CONFIRMACION"
  | "POSIBLE_DUPLICADO"
  | "ERROR";

export type ModoCarga = "obligatorios" | "completo";

export type PoblacionCarga = "ACTIVOS" | "PASIVOS";

export interface TipoCargaCatalogo {
  clave: string;
  nombre: string;
  descripcion: string;
  poblaciones: PoblacionCarga[];
}

export const TIPOS_CARGA_DISPONIBLES: TipoCargaCatalogo[] = [
  {
    clave: "datos_personales",
    nombre: "Datos personales",
    descripcion:
      "Cédula, nombres, apellidos, sexo, fecha de nacimiento, teléfonos y correo. En pasivos incluye los datos del pase a pasivo.",
    poblaciones: ["ACTIVOS", "PASIVOS"],
  },
  {
    clave: "cargo_asignacion",
    nombre: "Cargo y asignación",
    descripcion:
      "Código de cargo, tipo de nómina, motivo y fecha de ingreso o reingreso. Solo para personal activo.",
    poblaciones: ["ACTIVOS"],
  },
  {
    clave: "familiares",
    nombre: "Familiares",
    descripcion: "Cédula titular, datos de familiares, parentesco e hijos sin cédula.",
    poblaciones: ["ACTIVOS", "PASIVOS"],
  },
  {
    clave: "contactos_emergencia",
    nombre: "Contactos de emergencia",
    descripcion: "Cédula titular, nombres de contacto, parentesco y número telefónico.",
    poblaciones: ["ACTIVOS", "PASIVOS"],
  },
  {
    clave: "formacion_academica",
    nombre: "Formación académica",
    descripcion: "Títulos académicos, institución y fechas de inicio/fin.",
    poblaciones: ["ACTIVOS", "PASIVOS"],
  },
  {
    clave: "formacion_complementaria",
    nombre: "Formación complementaria",
    descripcion: "Cursos realizados, institución, fechas y total de horas.",
    poblaciones: ["ACTIVOS", "PASIVOS"],
  },
  {
    clave: "vivienda",
    nombre: "Vivienda",
    descripcion: "Ubicación geográfica (estado, municipio, parroquia) y dirección exacta.",
    poblaciones: ["ACTIVOS", "PASIVOS"],
  },
  {
    clave: "salud_tallas",
    nombre: "Salud y tallas",
    descripcion: "Discapacidad, alergias, patologías crónicas y tallas de vestimenta.",
    poblaciones: ["ACTIVOS", "PASIVOS"],
  },
  {
    clave: "antecedentes_laborales",
    nombre: "Antecedentes laborales",
    descripcion: "Organismos anteriores en la Administración Pública y fechas de ingreso/egreso.",
    poblaciones: ["ACTIVOS", "PASIVOS"],
  },
];

export function tiposDePoblacion(poblacion: PoblacionCarga): TipoCargaCatalogo[] {
  return TIPOS_CARGA_DISPONIBLES.filter((tipo) => tipo.poblaciones.includes(poblacion));
}

export interface MovimientoCondicion {
  tipo: "ACTIVO_A_PASIVO" | "PASIVO_A_ACTIVO" | string;
  condicion_actual: "ACTIVO" | "PASIVO" | string;
  condicion_nueva: "ACTIVO" | "PASIVO" | string;
  fecha: string;
  motivo: string;
  motivo_id: number | null;
  tipo_nomina: string;
  tipo_nomina_id: number | null;
  cargo_codigo: string;
  cargo_id: number | null;
  descripcion: string;
  faltantes: string[];
  completo: boolean;
  origen?: { tipo: string; numero_fila: number } | null;
  aplicado?: boolean;
}

export interface CargaMasivaResumen {
  id: string;
  archivo: string;
  estado: EstadoCarga;
  poblacion: PoblacionCarga;
  tipos: string[];
  filas_total: number;
  filas_validas: number;
  filas_error: number;
  filas_confirmacion: number;
  filas_confirmadas: number;
  /** FIX-CARGA3: conteos antes de aplicar. */
  filas_nuevo?: number;
  filas_actualizar?: number;
  filas_posible_duplicado?: number;
  creada_en: string;
}

export interface CargaMasivaFila {
  id: string;
  tipo: string;
  numero_fila: number;
  estado: EstadoFila;
  detalle: string;
  datos: Record<string, unknown>;
  aplicada: boolean;
  confirmada: boolean;
  confirmada_por_cedula: string;
  confirmada_en: string | null;
  movimiento: MovimientoCondicion | null;
  error_aplicacion: string | null;
}

export interface CargaMasivaDetalle extends CargaMasivaResumen {
  filas: CargaMasivaFila[];
}
