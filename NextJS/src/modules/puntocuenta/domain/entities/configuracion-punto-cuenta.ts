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
    descripcion: "Cambio en el campo Nivel (Dependencia).",
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
  { tag: "{nombre}", desc: "Nombre completo del trabajador" },
  { tag: "{cedula}", desc: "Cédula de identidad" },
  { tag: "{cargo}", desc: "Denominación del cargo / puesto" },
  { tag: "{origen}", desc: "Gerencia / Oficina de origen" },
  { tag: "{destino}", desc: "Gerencia / Oficina de destino" },
  { tag: "{fecha}", desc: "Fecha del movimiento" },
  { tag: "{motivo}", desc: "Motivo administrativo" },
  { tag: "{numero}", desc: "Número correlativo de punto de cuenta" },
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
  firmas: FirmaItem[];
  mostrar_nivel: boolean;
  plantillas_procesos?: Record<string, PlantillaProceso>;
  variables_disponibles?: VariableDisponible[];
  version: number;
  actualizado_por_id?: number | null;
  updated_at?: string | null;
}
