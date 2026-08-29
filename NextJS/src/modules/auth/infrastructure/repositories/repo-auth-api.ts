/**
 * Adaptador de repositorio de autenticación (paso 10 del checklist §II.8).
 * Implementa el puerto `RepoAutenticacion` combinando HTTP + mapper.
 */
import type { RepoAutenticacion } from "../../domain/ports/repo-auth";
import type { CredencialesLogin, SesionEntity } from "../../domain/entities/sesion-entity";
import { postLogin } from "../http/auth-api";
import { mapperSesion } from "../mappers/mapper-sesion";

export const repoAutenticacionApi: RepoAutenticacion = {
  async iniciarSesion(credenciales: CredencialesLogin): Promise<SesionEntity> {
    const data = await postLogin(credenciales);
    return mapperSesion(data);
  },
};
