import { cache } from "react";

/**
 * Rol de la sesión recordado durante la petición en curso. Al vencer el token se borran las cookies de
 * sesión (también la de NextAuth), así que el rol hay que guardarlo ANTES: así el `AuthSessionExpiredError`
 * lo lleva y la redirección sabe si es un postulante (su acceso) o un empleado (el login del personal).
 * Sin contexto de petición no memoiza: el rol queda desconocido y se va al login del personal.
 */
const contenedor = cache(() => ({ rol: undefined as string | undefined }));

export function recordarRolSesion(rol: string | undefined | null): void {
  if (rol) contenedor().rol = rol;
}

export function rolSesionRecordado(): string | undefined {
  return contenedor().rol;
}
