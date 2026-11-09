/**
 * Entidad de dominio del catálogo de departamentos (Regla R1), alineada a
 * `DepartamentoLecturaSerializer`. No conoce HTTP ni DTOs.
 */
export interface DepartamentoEntity {
  readonly id: number;
  readonly nombre: string;
  readonly descripcion: string;
}

export interface PermisoEntity {
  readonly codigo: string;
  readonly nombre: string;
}
