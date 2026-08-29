import { apiFetchGet } from "@/lib/utils";
import { apiFetchBlob, apiFetch } from "@/lib/api-client";
import type {
  ApiResponse,
  Pregunta,
  InfoCode,
  DewllingInfo,
  ReporteCensoData,
} from "@/app/types/types";
import { SchemaCensoExcelType } from "../schema/schema-autogestion-excel";

export const getPreguntas = async (): Promise<ApiResponse<Pregunta[]>> => {
  return apiFetchGet<Pregunta[]>("v1/autogestion/preguntas/");
};

export interface CensoEmpleadoItem {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  carnet_patria: string | null;
  cargos: InfoCode[];
  datos_vivienda: DewllingInfo | null;
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

/**
 * ADVERTENCIA (Fase 1 del plan de reparación): el backend real
 * (`GET /api/v1/autogestion/censo/<cedula>/`) devuelve una lista plana de
 * `RespuestaEncuestaSerializer` (id, pregunta_id, pregunta_enunciado,
 * opcion_id, opcion_texto, respuesta_texto) — NO el resumen enriquecido con
 * cargo/vivienda/APN que espera `CensoEmpleadoItem` más abajo. Esa
 * agregación no existe todavía en el backend (ver Fase 2.2/4 del plan);
 * consumir esta función tal cual seguirá rompiendo hasta que se construya.
 */
export const consultarCensoEmpleado = async (cedula?: string) => {
  if (!cedula) return { status: 'error', message: 'Cédula requerida.', data: [] as CensoEmpleadoItem[] };
  const url = `v1/autogestion/censo/${encodeURIComponent(cedula)}/`;
  return apiFetchGet<CensoEmpleadoItem[]>(url);
};

/**
 * SIN EQUIVALENTE EN EL BACKEND (Fase 1 del plan de reparación): no existe
 * ningún endpoint de exportación a Excel bajo `apps.autogestion` — el
 * permiso `autogestion.censo_exportar` está sembrado pero sin vista/caso de
 * uso detrás (ver auditoría, Fase 2.4/4 del plan de reparación). Estas dos
 * funciones seguirán fallando con 404 hasta que ese endpoint se construya.
 */
export const exportarCensoExcel = async () => {
  return apiFetchBlob("v1/autogestion/censo/exportar-excel/", {
    method: "POST",
  });
};

export const exportarCensoExcelConFiltros = async (
  payload: SchemaCensoExcelType,
): Promise<globalThis.Blob> => {
  return apiFetchBlob("v1/autogestion/censo/exportar-excel/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  codigo_postal_id?: number;
}

interface SubmitPayload {
  carnet_patria: string;
  datos_vivienda: ViviendaData;
  respuestas: RespuestaItem[];
}

/**
 * ADVERTENCIA (Fase 1 del plan de reparación): el backend real
 * (`GET /api/v1/autogestion/censo/reporte-dependencias/`) devuelve una
 * lista `[{dependencia_id, dependencia, total_empleados,
 * empleados_censados}]`, no el objeto `{pie_chart, bar_chart}` que espera
 * `ReporteCensoData` — la agregación para gráficos no existe en el backend
 * todavía (Fase 4 del plan). El filtro jerárquico completo
 * (dirección general/línea/coordinación) tampoco está implementado del lado
 * del servidor; solo agrupa por dependencia.
 */
export const getReporteCensoDependencias = async (
  searchParams: string | undefined,
): Promise<ApiResponse<ReporteCensoData>> => {
  const url = searchParams
    ? `v1/autogestion/censo/reporte-dependencias/?${searchParams}`
    : `v1/autogestion/censo/reporte-dependencias/`;
  return apiFetchGet<ReporteCensoData>(url);
};

/**
 * El backend solo persiste `respuestas` (`RegistrarCensoInputSerializer`).
 * `datos_vivienda` viaja en el payload pero el serializer real lo ignora en
 * silencio (campo desconocido, sin error) — no se pierde de forma ruidosa,
 * pero tampoco se guarda todavía (Fase 4 del plan de reparación).
 * `carnet_patria` sí se preserva porque además viaja como respuesta de la
 * pregunta id=1 dentro de `respuestas` (ver `page.tsx`).
 */
export const submitCensoVivienda = async (
  cedula: string,
  payload: SubmitPayload,
) => {
  return apiFetch<{ status: string; message: string }>(
    `v1/autogestion/censo/${cedula}/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
};
