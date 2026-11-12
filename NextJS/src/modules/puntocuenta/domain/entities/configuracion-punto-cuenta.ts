export interface FirmaItem {
  cargo: string;
  nombre: string;
}

export interface ProcesosHabilitados {
  cambio_oficina: boolean;
  cambio_nivel: boolean;
  cambio_division: boolean;
  cambio_cargo_misma_oficina: boolean;
  egreso_activo: boolean;
  pase_a_pasivo: boolean;
  encargaduria_prestamo: boolean;
  cambio_estatus: boolean;
}

export interface PlantillaProceso {
  personalizado: boolean;
  titulo: string;
  encabezado: string;
  cuerpo: string;
  presentado_a?: string;
  cargo_presentado_a?: string;
  presentado_por?: string;
  cargo_presentado_por?: string;
  unidad?: string;
  asunto?: string;
  exposicion?: string;
  propuesta?: string;
  base_legal?: string;
  observaciones_texto?: string;
  incluir_presentado_a?: boolean;
  incluir_presentado_por?: boolean;
  incluir_asunto?: boolean;
  incluir_exposicion?: boolean;
  incluir_propuesta?: boolean;
  incluir_base_legal?: boolean;
  incluir_decision?: boolean;
  incluir_observaciones?: boolean;
  incluir_tabla_resumen?: boolean;
  incluir_firmas?: boolean;
}

export interface VariableDisponible {
  tag: string;
  desc: string;
}

export const PROCESOS_METADATA: Record<keyof ProcesosHabilitados, { titulo: string; descripcion: string }> = {
  cambio_oficina: {
    titulo: "Cambio de Gerencia / Oficina",
    descripcion: "Traslado o cambio de Dirección General (RN-006-01).",
  },
  cambio_nivel: {
    titulo: "Cambio de Nivel",
    descripcion: "Cambio en el campo Nivel.",
  },
  cambio_division: {
    titulo: "Cambio de División / Coordinación",
    descripcion: "Modificación de Dirección de Línea o Coordinación.",
  },
  cambio_cargo_misma_oficina: {
    titulo: "Cambio de cargo (misma oficina)",
    descripcion: "Cambio de denominación/puesto dentro de la misma oficina.",
  },
  egreso_activo: {
    titulo: "Egreso de personal activo",
    descripcion: "Desincorporación o egreso del trabajador.",
  },
  pase_a_pasivo: {
    titulo: "Pase a pasivo",
    descripcion: "Pase a jubilado o pensionado de CONATEL.",
  },
  encargaduria_prestamo: {
    titulo: "Encargaduría / Préstamo de cargo",
    descripcion: "Asignación temporal de puesto en préstamo.",
  },
  cambio_estatus: {
    titulo: "Cambio de estatus",
    descripcion: "Suspensión o modificación del estatus del puesto.",
  },
};

export const VARIABLES_FALLBACK: VariableDisponible[] = [
  { tag: "{numero}", desc: "Número correlativo de punto de cuenta" },
  { tag: "{fecha}", desc: "Fecha del movimiento (DD/MM/AAAA)" },
  { tag: "{fecha_larga}", desc: "Fecha formal en texto largo (ej. 5 de noviembre de 2026)" },
  { tag: "{nombre}", desc: "Nombre completo del trabajador" },
  { tag: "{cedula}", desc: "Cédula de identidad" },
  { tag: "{cargo}", desc: "Denominación del cargo / puesto actual" },
  { tag: "{cargo_destino}", desc: "Denominación del cargo de destino" },
  { tag: "{codigo_cargo}", desc: "Código del cargo" },
  { tag: "{nivel}", desc: "Nivel jerárquico o dependencia" },
  { tag: "{tipo_personal}", desc: "Tipo de personal (fijo, contratado, etc.)" },
  { tag: "{origen}", desc: "Gerencia / Oficina de origen" },
  { tag: "{destino}", desc: "Gerencia / Oficina de destino" },
  { tag: "{motivo}", desc: "Motivo administrativo" },
  { tag: "{fecha_efectiva}", desc: "Fecha efectiva del movimiento" },
  { tag: "{fecha_ingreso}", desc: "Fecha de ingreso a la institución" },
  { tag: "{anios_servicio}", desc: "Años de servicio en la institución" },
  { tag: "{presentado_a}", desc: "Nombre de la autoridad a quien se presenta" },
  { tag: "{cargo_presentado_a}", desc: "Cargo de la autoridad a quien se presenta" },
  { tag: "{presentado_por}", desc: "Nombre del proponente o responsable de unidad" },
  { tag: "{cargo_presentado_por}", desc: "Cargo del proponente" },
  { tag: "{unidad}", desc: "Unidad u oficina remitente" },
];

export const TAGS_PERMITIDOS = new Set(VARIABLES_FALLBACK.map((v) => v.tag));

export function extraerVariablesTexto(texto: string): string[] {
  const match = texto.match(/\{[a-zA-Z0-9_]+\}/g);
  return match ?? [];
}

export function validarVariablesTexto(texto: string, permitidas: Set<string> = TAGS_PERMITIDOS): string[] {
  const encontradas = extraerVariablesTexto(texto);
  return encontradas.filter((tag) => !permitidas.has(tag));
}

export interface ConfiguracionPuntoCuenta {
  id?: string;
  generar: boolean;
  procesos_habilitados: ProcesosHabilitados;
  titulo: string;
  encabezado: string;
  cuerpo: string;
  presentado_a?: string;
  cargo_presentado_a?: string;
  presentado_por?: string;
  cargo_presentado_por?: string;
  unidad?: string;
  asunto?: string;
  exposicion?: string;
  propuesta?: string;
  base_legal?: string;
  observaciones_texto?: string;
  incluir_presentado_a?: boolean;
  incluir_presentado_por?: boolean;
  incluir_asunto?: boolean;
  incluir_exposicion?: boolean;
  incluir_propuesta?: boolean;
  incluir_base_legal?: boolean;
  incluir_decision?: boolean;
  incluir_observaciones?: boolean;
  incluir_tabla_resumen?: boolean;
  incluir_firmas?: boolean;
  firmas: FirmaItem[];
  mostrar_nivel: boolean;
  plantillas_procesos?: Record<string, PlantillaProceso>;
  variables_disponibles?: VariableDisponible[];
  version: number;
  actualizado_por_id?: number | null;
  updated_at?: string | null;
}
