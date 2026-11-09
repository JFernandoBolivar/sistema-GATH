export interface ReglaParentescoDTO {
  id: number;
  descripcion: string;
  aplica_familiar: boolean;
  // FIX-FAM2: reglas configurables del parentesco.
  es_hijo: boolean;
  menor_a_cargo: boolean;
  sin_cedula_hasta_edad: number | null;
  edad_minima: number | null;
  diferencia_minima: number | null;
  diferencia_tipo: "NINGUNA" | "MENOR" | "MAYOR";
  sexo_permitido: "" | "M" | "F";
  soporte_sugerido: string;
  activo: boolean;
}

export interface CategoriaMotivoItemDTO {
  id: number;
  categoria: string;
}

export interface ReglaMotivoDTO {
  id: number;
  movimiento: string;
  categoria_id: number;
  categoria_nombre: string;
  es_reservado: boolean;
  activo?: boolean;
}

export interface ReglaNominaDTO {
  id: number;
  nomina: string;
  requiere_codig: boolean;
  es_activo: boolean;
  /** Calculada por el backend: su nombre y estado activo no se editan. */
  es_reservada: boolean;
}

export interface ReglaPaisDTO {
  id: number;
  nombre: string;
  codigo: string;
  /** País por defecto del sistema: no se elimina. */
  es_venezuela: boolean;
}

export interface ReglaTipoSoporteDTO {
  id: number;
  codigo: string;
  nombre: string;
  es_reservado: boolean;
  es_protegido: boolean;
  orden: number;
}

export interface ReglaChecklistSoporteDTO {
  id: number;
  seccion: string;
  tipo_soporte_id: number;
  codigo: string;
  nombre: string;
  etiqueta: string;
  permitido: boolean;
  requerido: boolean;
  orden: number;
}

export interface SeccionSoporteDTO {
  codigo: string;
  nombre: string;
}

export interface ReglasCatalogosCompletoDTO {
  parentescos: ReglaParentescoDTO[];
  categorias_motivo: CategoriaMotivoItemDTO[];
  motivos: ReglaMotivoDTO[];
  nominas: ReglaNominaDTO[];
  paises: ReglaPaisDTO[];
  tipos_soporte: ReglaTipoSoporteDTO[];
  checklist_soporte: ReglaChecklistSoporteDTO[];
  secciones_soporte: SeccionSoporteDTO[];
}
