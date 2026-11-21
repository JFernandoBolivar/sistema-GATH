export class AuthSessionExpiredError extends Error {
  /** Rol que tenía la sesión al vencer (p. ej. "POSTULANTE"); decide a qué acceso se redirige. */
  readonly rol?: string;

  constructor(rol?: string) {
    super("Sesión expirada. Redirigiendo al login...");
    this.name = "AuthSessionExpiredError";
    this.rol = rol;
  }
}
