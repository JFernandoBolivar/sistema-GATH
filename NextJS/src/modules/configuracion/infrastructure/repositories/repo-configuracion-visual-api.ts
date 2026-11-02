/**
 * Implementación del repositorio de Configuración Visual usando la API REST.
 */
import type { RepoConfiguracionVisual } from "../../domain/ports/repo-configuracion-visual";
import { configuracionApi } from "../http/configuracion-api";
import { configuracionVisualApiAEntidad } from "../mappers/mapper-configuracion-visual";

export const repoConfiguracionVisualApi: RepoConfiguracionVisual = {
  async obtener() {
    const envelope = await configuracionApi.obtener();
    return configuracionVisualApiAEntidad(envelope.data);
  },

  async actualizar(datos) {
    const payload: Record<string, unknown> = {};
    if (datos.tipoCintillo !== undefined) payload.tipo_cintillo = datos.tipoCintillo;
    if (datos.nombreEmpresa !== undefined) payload.nombre_empresa = datos.nombreEmpresa;
    if (datos.colorFondo !== undefined) payload.color_fondo = datos.colorFondo;

    const envelope = await configuracionApi.actualizar(payload);
    return configuracionVisualApiAEntidad(envelope.data);
  },

  async subirLogo(campo, archivo) {
    const formData = new FormData();
    formData.append("file", archivo);
    const envelope = await configuracionApi.subirLogo(campo, formData);
    return configuracionVisualApiAEntidad(envelope.data);
  },
};
