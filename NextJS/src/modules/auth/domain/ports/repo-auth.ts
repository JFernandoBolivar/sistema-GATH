/**
 * Puerto de autenticación (paso 3 del checklist §II.8). Contrato de dominio:
 * la implementación concreta vive en `infrastructure/repositories/`.
 */
import type { CredencialesLogin, SesionEntity } from "../entities/sesion-entity";

/** Datos de entrada para cambiar la contraseña de la cuenta autenticada. */
export interface CambiarPasswordInput {
  readonly passwordActual: string;
  readonly passwordNuevo: string;
}

export interface RepoAutenticacion {
  /** Autentica credenciales contra el backend y devuelve la sesión resultante. */
  iniciarSesion(credenciales: CredencialesLogin): Promise<SesionEntity>;
  /** Invalida la sesión en el backend (best-effort: no lanza si el backend falla). */
  cerrarSesion(): Promise<void>;
  /** Cambia la contraseña de la cuenta autenticada; devuelve el mensaje del backend. */
  cambiarPassword(input: CambiarPasswordInput): Promise<string>;
}
