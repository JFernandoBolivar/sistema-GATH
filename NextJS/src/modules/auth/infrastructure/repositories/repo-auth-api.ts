/**
 * Adaptador de repositorio de autenticación (paso 10 del checklist §II.8).
 * Implementa el puerto `RepoAutenticacion` combinando HTTP + mapper.
 */
import type {
  CambiarPasswordInput,
  RepoAutenticacion,
  RestablecerPasswordInput,
} from "../../domain/ports/repo-auth";
import type { CredencialesLogin, SesionEntity } from "../../domain/entities/sesion-entity";
import {
  postCambiarPassword,
  postLogin,
  postLogout,
  postRestablecerPassword,
  postSolicitarRecuperacion,
} from "../http/auth-api";
import { mapperSesion } from "../mappers/mapper-sesion";

export const repoAutenticacionApi: RepoAutenticacion = {
  async iniciarSesion(credenciales: CredencialesLogin): Promise<SesionEntity> {
    const data = await postLogin(credenciales);
    return mapperSesion(data);
  },

  async cerrarSesion(): Promise<void> {
    try {
      await postLogout();
    } catch {
      // Best-effort (documentado en el puerto): la sesión local se cierra
      // igual aunque el backend no esté disponible.
    }
  },

  async cambiarPassword(input: CambiarPasswordInput): Promise<string> {
    return postCambiarPassword(input);
  },

  async solicitarRecuperacion(identificador: string): Promise<string> {
    return postSolicitarRecuperacion(identificador);
  },

  async restablecerPassword(input: RestablecerPasswordInput): Promise<string> {
    return postRestablecerPassword(input);
  },
};

