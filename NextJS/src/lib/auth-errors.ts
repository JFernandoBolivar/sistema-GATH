export class AuthSessionExpiredError extends Error {
  constructor() {
    super("Sesión expirada. Redirigiendo al login...");
    this.name = "AuthSessionExpiredError";
  }
}
