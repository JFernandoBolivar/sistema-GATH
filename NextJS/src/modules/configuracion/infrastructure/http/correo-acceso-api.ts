/**
 * Cliente HTTP para Política de Correo de Acceso y Aplicación Masiva (A7).
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type {
  AplicarPoliticaMasivaRequestDTO,
  PoliticaCorreoAccesoDTO,
  ResultadoAplicarMasivoDTO,
  ResumenVistaPreviaDTO,
} from "../../application/dtos/correo-acceso-dto";

export const correoAccesoApi = {
  obtenerPolitica: () =>
    apiClient.get<ApiResponse<PoliticaCorreoAccesoDTO>>(
      "/api/v1/configuracion/correo-acceso/politica/",
    ),

  actualizarPolitica: (datos: PoliticaCorreoAccesoDTO) =>
    apiClient.put<ApiResponse<PoliticaCorreoAccesoDTO>>(
      "/api/v1/configuracion/correo-acceso/politica/",
      datos as unknown as Record<string, unknown>,
    ),

  obtenerVistaPrevia: (grupo: "activos" | "pasivos", incluirExcepciones: boolean = false) =>
    apiClient.get<ApiResponse<ResumenVistaPreviaDTO>>(
      `/api/v1/configuracion/correo-acceso/vista-previa/?grupo=${grupo}&incluir_excepciones=${incluirExcepciones}`,
    ),

  aplicarMasivo: (datos: AplicarPoliticaMasivaRequestDTO) =>
    apiClient.post<ApiResponse<ResultadoAplicarMasivoDTO>>(
      "/api/v1/configuracion/correo-acceso/aplicar/",
      datos as unknown as Record<string, unknown>,
    ),

  descargarExcelVistaPrevia: (grupo: "activos" | "pasivos", incluirExcepciones: boolean = false) =>
    apiClient.getBlob(
      `/api/v1/configuracion/correo-acceso/vista-previa/exportar-excel/?grupo=${grupo}&incluir_excepciones=${incluirExcepciones}`,
    ),
};
