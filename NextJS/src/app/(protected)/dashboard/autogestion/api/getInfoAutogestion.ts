import { apiFetchGet } from "@/lib/utils";
import { apiFetchBlob, apiFetch } from "@/lib/api-client";
import type { ApiResponse, Pregunta } from "@/app/types/types";

export const getPreguntas = async (): Promise<ApiResponse<Pregunta[]>> => {
  return apiFetchGet<Pregunta[]>("autogestion/preguntas/");
};

export interface CensoEmpleadoItem {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  carnet_patria: string | null;
  cargos: any[];
  datos_vivienda: any;
  total_apn: { years: number; months: number; days: number };
  fecha_ingreso_organismo: string | null;
  preguntas: {
    id: number;
    pregunta: string;
    tipo: string;
    opcion: { id: number; opcion: string } | null;
    respuesta: string;
  }[];
}

export const consultarCensoEmpleado = async (cedula?: string) => {
  const url = cedula
    ? `autogestion/censo-vivienda/consultar/?cedula=${encodeURIComponent(cedula)}`
    : `autogestion/censo-vivienda/consultar/`;
  return apiFetchGet<CensoEmpleadoItem[]>(url);
};

export const exportarCensoExcel = async () => {
  return apiFetchBlob("autogestion/censo-vivienda/exportar-excel/");
};

interface RespuestaItem {
  pregunta: number;
  opcion: number | null;
  respuesta: string;
}

interface ViviendaData {
  direccion_exacta?: string;
  estado_id?: number;
  municipio_id?: number;
  parroquia?: number;
  condicion_vivienda_id?: number;
  codigo_postal?: string;
}

interface SubmitPayload {
  carnet_patria: string;
  datos_vivienda: ViviendaData;
  respuestas: RespuestaItem[];
}

export const submitCensoVivienda = async (
  cedula: string,
  payload: SubmitPayload,
) => {
  return apiFetch<{ status: string; message: string }>(
    `autogestion/censo-vivienda/${cedula}/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
};
