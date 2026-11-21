import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type {
  AltaPostulanteResultado,
  CredencialEmitida,
  DatosAltaPostulante,
  DatosTransicion,
  DetalleExpediente,
  FiltrosBandeja,
  PaginaBandeja,
  ResultadoPsicofisico,
  DatosPsicofisico,
} from "../../domain/expediente";
import {
  altaDesdeApi,
  credencialDesdeApi,
  detalleDesdeApi,
  paginaDesdeApi,
  psicofisicoDesdeApi,
} from "../mappers/mapper-captacion";

const BASE = "/api/v1/postulacion";

type Crudo = Record<string, unknown>;

export const captacionApi = {
  bandeja: async (f: FiltrosBandeja): Promise<PaginaBandeja> => {
    const sobre = await apiClient.get<ApiResponse<Crudo>>(`${BASE}/expedientes/`, {
      params: {
        estado: f.estados.join(","),
        q: f.q?.trim(),
        desde: f.desde,
        hasta: f.hasta,
        pagina: f.pagina,
        page_size: f.tamano,
      },
    });
    return paginaDesdeApi(sobre.data);
  },

  detalle: async (id: string): Promise<DetalleExpediente> => {
    const sobre = await apiClient.get<ApiResponse<Crudo>>(`${BASE}/expedientes/${id}/`);
    return detalleDesdeApi(sobre.data);
  },

  transicion: async (id: string, t: DatosTransicion): Promise<DetalleExpediente> => {
    const sobre = await apiClient.post<ApiResponse<Crudo>>(`${BASE}/expedientes/${id}/transicion/`, {
      destino: t.destino,
      ...(t.motivo ? { motivo: t.motivo } : {}),
      ...(t.datos ? { datos: t.datos } : {}),
    });
    return detalleDesdeApi(sobre.data);
  },

  altaPostulante: async (d: DatosAltaPostulante): Promise<AltaPostulanteResultado> => {
    const sobre = await apiClient.post<ApiResponse<Crudo>>(`${BASE}/postulantes/`, {
      cedula: d.cedula,
      nombres: d.nombres,
      apellidos: d.apellidos,
      ...(d.correo ? { correo: d.correo } : {}),
      ...(d.telefonoMovil ? { telefono_movil: d.telefonoMovil } : {}),
    });
    return altaDesdeApi(sobre.data, sobre.message);
  },

  reponerCredencial: async (id: string): Promise<CredencialEmitida> => {
    const sobre = await apiClient.post<ApiResponse<Crudo>>(`${BASE}/expedientes/${id}/reponer-credencial/`);
    return credencialDesdeApi(sobre.data);
  },

  registrarPsicofisico: async (id: string, d: DatosPsicofisico, informe: File | null): Promise<ResultadoPsicofisico> => {
    const form = new FormData();
    form.set("resultado", d.resultado);
    form.set("fecha_aplicacion", d.fechaAplicacion);
    if (d.observaciones?.trim()) form.set("observaciones", d.observaciones.trim());
    if (informe) form.set("informe", informe);
    const sobre = await apiClient.postForm<ApiResponse<Crudo>>(`${BASE}/expedientes/${id}/psicofisico/`, form);
    return psicofisicoDesdeApi(sobre.data);
  },

  informe: (id: string) => apiClient.getBlob(`${BASE}/expedientes/${id}/psicofisico/informe/`),
};
