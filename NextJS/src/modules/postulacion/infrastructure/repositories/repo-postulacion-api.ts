import type { RepoPostulacion } from "../../application/ports/repo-postulacion";
import { construirCuerpoBorrador } from "../../domain/ventana1";
import { llamarPostulacion } from "../http/postulacion-api";
import {
  mapearCatalogosVentana2,
  mapearEnvio,
  mapearMiExpediente,
  mapearSesionInvitado,
  mapearVentana2,
} from "../mappers/mapper-postulacion";

export const repoPostulacionApi: RepoPostulacion = {
  async validarEnlace(tokenEnlace) {
    const d = await llamarPostulacion<{ numero?: unknown; vence_el?: unknown }>(
      `activar/?t=${encodeURIComponent(tokenEnlace)}`,
    );
    return { numero: String(d.numero ?? ""), venceEl: String(d.vence_el ?? "") };
  },
  async activarEnlace(tokenEnlace, cedula, claveNueva) {
    await llamarPostulacion<unknown>("activar/", {
      metodo: "POST",
      cuerpo: { token: tokenEnlace, cedula, clave_nueva: claveNueva },
    });
  },
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
  async obtenerVentana2(token) {
    return mapearVentana2(await llamarPostulacion<unknown>("ventana2/", { token }));
  },
  async guardarVentana2(token, cuerpo) {
    return mapearVentana2(await llamarPostulacion<unknown>("ventana2/", { metodo: "PUT", token, cuerpo }));
  },
  async catalogosVentana2(token, estadoId, municipioId) {
    const params = new URLSearchParams();
    if (estadoId) params.set("estado_id", String(estadoId));
    if (municipioId) params.set("municipio_id", String(municipioId));
    const consulta = params.size > 0 ? `?${params.toString()}` : "";
    return mapearCatalogosVentana2(await llamarPostulacion<unknown>(`ventana2/catalogos/${consulta}`, { token }));
  },
};
