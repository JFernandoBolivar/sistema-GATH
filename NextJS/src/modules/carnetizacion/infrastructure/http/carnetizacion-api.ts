/**
 * Cliente HTTP para Carnetización conectado a la API canónica /api/v1/carnetizacion/
 * (verificado contra `BACKEND/apps/carnetizacion/presentation/urls.py` +
 * `carnetizacion_serializers.py` — Fase 1 y O44 - E3).
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface CarnetApiItem {
  id: number;
  empleado_cedula: string;
  empleado_nombres: string;
  empleado_apellidos: string;
  security_hash: string;
  fecha_emision: string;
  motivo_id: number;
  motivo_nombre: string;
  activo: boolean;
  observaciones: string | null;
  plantilla_id?: string | null;
  plantilla_version?: number | null;
  plantilla_snapshot?: Record<string, unknown> | null;
}

export interface PlantillaCarnetApiItem {
  id: number | string;
  nombre: string;
  imagen_url: string;
  activo: boolean;
  creado: string;
}

export interface TipoCredencialApiItem {
  codigo: string;
  nombre: string;
  descripcion: string;
  ancho_mm: number;
  alto_mm: number;
  orientacion: "vertical" | "horizontal";
  grupo: string;
  activo: boolean;
  orden: number;
}

export interface PlantillaMotorApiItem {
  id: string;
  nombre: string;
  codigo_tipo: string;
  ancho_mm: number;
  alto_mm: number;
  orientacion: "vertical" | "horizontal";
  regla_criterio: string;
  regla_valor: string;
  estado: "borrador" | "publicada" | "archivada";
  activa: boolean;
  version: number;
  definicion: Record<string, unknown>;
  creado: string;
  actualizado: string;
  plantilla_raiz_id?: string | null;
  creado_por?: string | null;
  descripcion: string;
  imagen_url: string;
}

export interface ElementoBibliotecaApiItem {
  id: string;
  nombre: string;
  categoria: "logo" | "firma" | "imagen";
  archivo_url: string;
  tamano_bytes: number;
  mime_type: string;
  ancho_px: number | null;
  alto_px: number | null;
  creado: string;
  creado_por?: string | null;
  descripcion?: string;
}

export interface CampoCredencialApiItem {
  codigo: string;
  etiqueta: string;
  grupo: string;
  tipo_credencial: string;
  sensible: boolean;
  es_personalizado: boolean;
  descripcion: string;
  valor_ejemplo: string;
}

export interface FichaQrApiItem {
  es_valido: boolean;
  estado: "VIGENTE" | "ANULADO" | "VENCIDO" | "NO_REGISTRADO";
  mensaje: string;
  security_hash?: string | null;
  nivel_acceso: "PUBLICO" | "CON_SESION" | "ADMINISTRADOR";
  datos: {
    nombre: string;
    foto_url?: string;
    cargo: string;
    codigo_cargo?: string;
    ubicacion: string;
    cedula?: string | null;
    fecha_nacimiento?: string | null;
    contactos_emergencia: { nombre: string; parentesco: string; telefono: string }[];
    salud?: {
      alergias: string[];
      patologias: string[];
      discapacidades: string[];
      grupo_sanguineo?: string;
    } | null;
    direccion_vivienda?: string;
    expediente_completo_autorizado?: boolean;
  } | null;
  salud_disponible: boolean;
  fecha_emision?: string | null;
  fecha_vencimiento?: string | null;
}

export interface ValidacionCarnetApiItem {
  es_valido: boolean;
  mensaje: string;
  carnet: CarnetApiItem | null;
}

export interface EstadisticaMotivoCarnetApiItem {
  motivo_id: number;
  motivo: string;
  total: number;
}

export interface EstadisticasCarnetApiItem {
  total: number;
  activos: number;
  revocados: number;
  emitidos_hoy: number;
  emitidos_mes: number;
  por_motivo: EstadisticaMotivoCarnetApiItem[];
}

export interface EmpleadoCarnetApiItem {
  id?: number;
  cedula: string;
  nombres?: string;
  apellidos?: string;
  nombre_completo?: string;
  cargo?: string;
  departamento?: string;
  codigo?: string;
  codigo_empleado?: string;
  foto_url?: string | null;
}

export const carnetizacionApi = {
  getCarnets: async (cedula?: string) => {
    const envelope = await apiClient.get<ApiResponse<CarnetApiItem[]>>("/api/v1/carnetizacion/", { params: { cedula } });
    return envelope.data ?? [];
  },

  emitir: async (empleadoCedula: string, motivoId: number, observaciones?: string, plantillaId?: string) => {
    const envelope = await apiClient.post<ApiResponse<CarnetApiItem>>("/api/v1/carnetizacion/", {
      empleado_cedula: empleadoCedula,
      motivo_id: motivoId,
      observaciones,
      plantilla_id: plantillaId,
    });
    return envelope.data;
  },

  validarPorHash: async (securityHash: string) => {
    const envelope = await apiClient.get<ApiResponse<ValidacionCarnetApiItem>>(`/api/v1/carnetizacion/validar/hash/${securityHash}/`);
    return envelope.data;
  },

  validarPorId: async (carnetId: number) => {
    const envelope = await apiClient.get<ApiResponse<ValidacionCarnetApiItem>>(`/api/v1/carnetizacion/validar/${carnetId}/`);
    return envelope.data;
  },

  // --- Catálogo y Motor de Plantillas (O44 - E3) ---
  getTiposCredencial: async (grupo?: string) => {
    const envelope = await apiClient.get<ApiResponse<TipoCredencialApiItem[]>>(
      "/api/v1/carnetizacion/tipos-credencial/",
      { params: { grupo } },
    );
    return envelope.data ?? [];
  },

  getPlantillasMotor: async (tipo?: string, estado?: string, activas?: boolean) => {
    const envelope = await apiClient.get<ApiResponse<PlantillaMotorApiItem[]>>("/api/v1/carnetizacion/plantillas-motor/", {
      params: { tipo, estado, activas: activas ? "true" : undefined },
    });
    return envelope.data ?? [];
  },

  getPlantillaMotor: async (id: string | number) => {
    const envelope = await apiClient.get<ApiResponse<PlantillaMotorApiItem>>(`/api/v1/carnetizacion/plantillas-motor/${id}/`);
    return envelope.data;
  },

  crearPlantillaBorrador: async (data: Record<string, unknown>) => {
    const envelope = await apiClient.post<ApiResponse<PlantillaMotorApiItem>>("/api/v1/carnetizacion/plantillas-motor/", data);
    return envelope.data;
  },

  actualizarPlantillaBorrador: async (id: string | number, data: Record<string, unknown>) => {
    const envelope = await apiClient.put<ApiResponse<PlantillaMotorApiItem>>(`/api/v1/carnetizacion/plantillas-motor/${id}/`, data);
    return envelope.data;
  },

  publicarPlantillaMotor: async (id: string | number, activar: boolean = true) => {
    const envelope = await apiClient.post<ApiResponse<PlantillaMotorApiItem>>(`/api/v1/carnetizacion/plantillas-motor/${id}/publicar/`, {
      activar,
    });
    return envelope.data;
  },

  activarPlantillaMotor: async (id: string | number) => {
    const envelope = await apiClient.post<ApiResponse<PlantillaMotorApiItem>>(`/api/v1/carnetizacion/plantillas-motor/${id}/activar/`);
    return envelope.data;
  },

  getVersionesPlantilla: async (raizId: string | number) => {
    const envelope = await apiClient.get<ApiResponse<PlantillaMotorApiItem[]>>(`/api/v1/carnetizacion/plantillas-motor/${raizId}/versiones/`);
    return envelope.data ?? [];
  },

  getPlantillaActiva: async (tipo: string = "trabajador", criterio: string = "todos", valor: string = "*") => {
    const envelope = await apiClient.get<ApiResponse<PlantillaMotorApiItem>>("/api/v1/carnetizacion/plantillas-motor/activa/", {
      params: { tipo, criterio, valor },
    });
    return envelope.data;
  },

  // --- Biblioteca de Medios (O44 - E4) ---
  getBiblioteca: async (categoria?: string) => {
    const envelope = await apiClient.get<ApiResponse<ElementoBibliotecaApiItem[]>>("/api/v1/carnetizacion/biblioteca/", {
      params: { categoria },
    });
    return envelope.data ?? [];
  },

  subirElementoBiblioteca: async (formData: FormData) => {
    const envelope = await apiClient.postForm<ApiResponse<ElementoBibliotecaApiItem>>("/api/v1/carnetizacion/biblioteca/", formData);
    return envelope.data;
  },

  eliminarElementoBiblioteca: async (id: string) => {
    await apiClient.delete<ApiResponse<null>>(`/api/v1/carnetizacion/biblioteca/${id}/`);
    return true;
  },

  // --- Registro de Campos Autorizados y Personalizados (O44 - E5) ---
  getCampos: async (tipo: string = "trabajador") => {
    const envelope = await apiClient.get<ApiResponse<CampoCredencialApiItem[]>>("/api/v1/carnetizacion/campos/", {
      params: { tipo },
    });
    return envelope.data ?? [];
  },

  crearCampoPersonalizado: async (data: Record<string, unknown>) => {
    const envelope = await apiClient.post<ApiResponse<CampoCredencialApiItem>>("/api/v1/carnetizacion/campos/personalizados/", data);
    return envelope.data;
  },

  eliminarCampoPersonalizado: async (codigo: string) => {
    await apiClient.delete<ApiResponse<null>>(`/api/v1/carnetizacion/campos/personalizados/${codigo}/`);
    return true;
  },

  // --- Legacy Plantillas ---
  getPlantillas: async () => {
    const envelope = await apiClient.get<ApiResponse<PlantillaCarnetApiItem[]>>("/api/v1/carnetizacion/plantillas/");
    return envelope.data ?? [];
  },

  activarPlantilla: async (plantillaId: number | string) => {
    const envelope = await apiClient.post<ApiResponse<PlantillaCarnetApiItem>>(`/api/v1/carnetizacion/plantillas/${plantillaId}/activar/`);
    return envelope.data;
  },

  crearPlantilla: async (nombre: string, imagen: File, activar?: boolean) => {
    const formData = new FormData();
    formData.append("nombre", nombre);
    formData.append("imagen", imagen);
    if (activar) formData.append("activar", "true");
    const envelope = await apiClient.postForm<ApiResponse<PlantillaCarnetApiItem>>("/api/v1/carnetizacion/plantillas/crear/", formData);
    return envelope.data;
  },

  descargarPdf: (carnetId: number) =>
    apiClient.getBlob(`/api/v1/carnetizacion/${carnetId}/pdf/`),

  revocar: (carnetId: number) =>
    apiClient.post<CarnetApiItem>(`/api/v1/carnetizacion/${carnetId}/revocar/`),

  getEstadisticas: async () => {
    const envelope = await apiClient.get<ApiResponse<EstadisticasCarnetApiItem>>("/api/v1/carnetizacion/estadisticas/");
    return envelope.data;
  },

  getEmpleado: async (cedula: string): Promise<EmpleadoCarnetApiItem | null> => {
    try {
      const envelope = await apiClient.get<ApiResponse<EmpleadoCarnetApiItem>>(`/api/v1/personal/${cedula}/`);
      return envelope.data ?? null;
    } catch {
      return null;
    }
  },

  buscarPersonal: async (query: string) => {
    const envelope = await apiClient.get<ApiResponse<EmpleadoCarnetApiItem[]>>("/api/v1/carnetizacion/buscar/", {
      params: { q: query },
    });
    return envelope.data ?? [];
  },

  getMotivos: async () => {
    const envelope = await apiClient.get<ApiResponse<{ id: number; nombre: string }[]>>("/api/v1/carnetizacion/motivos/");
    return envelope.data ?? [];
  },

  actualizarVistaPrevia: async (cedula: string, nombre: string) => {
    const envelope = await apiClient.post<ApiResponse<{ vista_previa: string }>>(`/api/v1/carnetizacion/actualizar-vista-previa/${cedula}/`, {
      nombre,
      cedula,
    });
    return {
      success: envelope.status === "success",
      vista_previa: envelope.data?.vista_previa || "",
    };
  },

  subirFoto: async (cedula: string, nombre: string, foto: File) => {
    const formData = new FormData();
    formData.append("foto", foto);
    formData.append("nombre", nombre);
    formData.append("cedula", cedula);
    const envelope = await apiClient.postForm<ApiResponse<{ vista_previa: string; filename?: string; message?: string }>>(
      `/api/v1/carnetizacion/subir-foto/${cedula}/`,
      formData,
    );
    return {
      success: envelope.status === "success",
      vista_previa: envelope.data?.vista_previa || "",
      filename: envelope.data?.filename,
      message: envelope.data?.message || envelope.message,
    };
  },

  generarCarnetPdf: async (cedula: string, motivoId: number, nombre: string) => {
    return apiClient.postBlob(`/api/v1/carnetizacion/generar/${cedula}/`, {
      motivo_id: motivoId,
      observaciones: "",
      datos_editados: { nombre, cedula },
    });
  },

  // --- QR y Privacidad por Dato (O44 - E9) ---
  consultarFichaQr: async (securityHash: string) => {
    const envelope = await apiClient.get<ApiResponse<FichaQrApiItem>>(`/api/v1/carnetizacion/public/qr/${securityHash}/`);
    return envelope.data;
  },

  consultarSaludEmergencia: async (securityHash: string) => {
    const envelope = await apiClient.post<ApiResponse<FichaQrApiItem>>(`/api/v1/carnetizacion/public/qr/${securityHash}/medica/`);
    return envelope.data;
  },

  getPreferenciasPrivacidad: async () => {
    const envelope = await apiClient.get<ApiResponse<Record<string, "PUBLICO" | "CON_SESION" | "SOLO_PERSONAL">>>("/api/v1/carnetizacion/autogestion/privacidad/");
    return envelope.data ?? {};
  },

  guardarPreferenciasPrivacidad: async (preferencias: Record<string, "PUBLICO" | "CON_SESION" | "SOLO_PERSONAL" | undefined>) => {
    const envelope = await apiClient.put<ApiResponse<Record<string, "PUBLICO" | "CON_SESION" | "SOLO_PERSONAL">>>("/api/v1/carnetizacion/autogestion/privacidad/", {
      preferencias,
    });
    return envelope.data ?? {};
  },
};
