export interface ReglaParentescoDTO {
  id: number;
  descripcion: string;
  aplica_familiar: boolean;
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
}

export interface ReglaNominaDTO {
  id: number;
  nomina: string;
  requiere_codig: boolean;
  es_activo: boolean;
}

export interface ReglasCatalogosCompletoDTO {
  parentescos: ReglaParentescoDTO[];
  categorias_motivo: CategoriaMotivoItemDTO[];
  motivos: ReglaMotivoDTO[];
  nominas: ReglaNominaDTO[];
}
