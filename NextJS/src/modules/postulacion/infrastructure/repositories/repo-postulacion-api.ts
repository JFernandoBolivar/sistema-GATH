import type { RepoPostulacion } from "../../application/ports/repo-postulacion";
import { construirCuerpoBorrador } from "../../domain/ventana1";
import { llamarPostulacion } from "../http/postulacion-api";
import {
  mapearEnvio,
  mapearMiExpediente,
  mapearSesionInvitado,
} from "../mappers/mapper-postulacion";

export const repoPostulacionApi: RepoPostulacion = {
  async obtenerMiExpediente(token) {
    return mapearMiExpediente(await llamarPostulacion<unknown>("mi-expediente/", { token }));
  },
  async guardarBorrador(token, valores) {
    const cuerpo = construirCuerpoBorrador(valores);
    return mapearMiExpediente(
      await llamarPostulacion<unknown>("borrador/", { metodo: "PUT", token, cuerpo }),
    );
  },
  async enviar(token) {
    return mapearEnvio(await llamarPostulacion<unknown>("enviar/", { metodo: "POST", token }));
  },
  async cambiarClave(token, claveActual, claveNueva) {
    return mapearSesionInvitado(
      await llamarPostulacion<unknown>("cambiar-clave/", {
        metodo: "POST",
        token,
        cuerpo: { clave_actual: claveActual, clave_nueva: claveNueva },
      }),
    );
  },
};
