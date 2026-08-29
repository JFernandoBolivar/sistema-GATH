/**
 * Puerto de autenticación (paso 3 del checklist §II.8). Contrato de dominio:
 * la implementación concreta vive en `infrastructure/repositories/`.
 */
import type { CredencialesLogin, SesionEntity } from "../entities/sesion-entity";

export interface RepoAutenticacion {
  /** Autentica credenciales contra el backend y devuelve la sesión resultante. */
  iniciarSesion(credenciales: CredencialesLogin): Promise<SesionEntity>;
}
