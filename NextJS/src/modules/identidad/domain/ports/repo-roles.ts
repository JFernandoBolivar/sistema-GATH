/**
 * Puerto del Repositorio de Roles (Reglas R1, R4), alineado a los endpoints de
 * `apps.identidad` (catálogo de roles).
 */
import type { RolEntity } from "../entities/rol-entity";

export interface RolCrearInput {
  readonly nombreRol: string;
  readonly descripcionRol?: string | null;
}

export interface RepoRoles {
  listar(): Promise<RolEntity[]>;
  crear(input: RolCrearInput): Promise<RolEntity>;
  actualizar(id: number, input: Partial<RolCrearInput>): Promise<RolEntity>;
  eliminar(id: number): Promise<void>;
}
