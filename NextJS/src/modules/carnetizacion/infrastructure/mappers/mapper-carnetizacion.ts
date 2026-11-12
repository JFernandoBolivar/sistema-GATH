/**
 * Mappers para convertir datos de Carnetización a entidades de dominio (O44 - E3).
 */
import type {
  CampoCredencial,
  Carnet,
  DatosCarnetEmpleado,
  ElementoBiblioteca,
  EstadisticasCarnet,
  FichaQr,
  GrupoCampo,
  PaginaCarnet,
  PlantillaCarnet,
  PlantillaMotor,
  TipoCredencial,
} from "../../domain/entities/carnet";
import type {
  CampoCredencialApiItem,
  CarnetApiItem,
  ElementoBibliotecaApiItem,
  EmpleadoCarnetApiItem,
  EstadisticasCarnetApiItem,
  FichaQrApiItem,
  PlantillaCarnetApiItem,
  PlantillaMotorApiItem,
  TipoCredencialApiItem,
} from "../http/carnetizacion-api";

export function carnetApiAEntidad(raw: CarnetApiItem): Carnet {
  return {
    id: raw.id,
    empleadoCedula: raw.empleado_cedula,
    empleadoNombres: raw.empleado_nombres,
    empleadoApellidos: raw.empleado_apellidos,
    securityHash: raw.security_hash,
    fechaEmision: raw.fecha_emision,
    motivoId: raw.motivo_id,
    motivoNombre: raw.motivo_nombre,
    activo: raw.activo,
    observaciones: raw.observaciones,
  };
}

export function tipoCredencialApiAEntidad(raw: TipoCredencialApiItem): TipoCredencial {
  return {
    codigo: raw.codigo,
    nombre: raw.nombre,
    descripcion: raw.descripcion || "",
    ancho_mm: raw.ancho_mm,
    alto_mm: raw.alto_mm,
    orientacion: raw.orientacion,
    grupo: raw.grupo,
    activo: raw.activo,
    orden: raw.orden,
  };
}

export function plantillaMotorApiAEntidad(raw: PlantillaMotorApiItem): PlantillaMotor {
  return {
    id: String(raw.id),
    nombre: raw.nombre,
    codigo_tipo: raw.codigo_tipo,
    ancho_mm: raw.ancho_mm,
    alto_mm: raw.alto_mm,
    orientacion: raw.orientacion,
    regla_criterio: raw.regla_criterio,
    regla_valor: raw.regla_valor,
    estado: raw.estado,
    activa: raw.activa,
    version: raw.version,
    definicion: raw.definicion,
    creado: raw.creado,
    actualizado: raw.actualizado,
    plantilla_raiz_id: raw.plantilla_raiz_id ? String(raw.plantilla_raiz_id) : null,
    creado_por: raw.creado_por ? String(raw.creado_por) : null,
    descripcion: raw.descripcion || "",
    imagen_url: raw.imagen_url || "",
  };
}

export function plantillaCarnetApiAEntidad(raw: PlantillaCarnetApiItem): PlantillaCarnet {
  return {
    id: typeof raw.id === "number" ? raw.id : Number(raw.id) || 1,
    nombre: raw.nombre,
    imagenUrl: raw.imagen_url,
    activo: raw.activo,
    creado: raw.creado,
  };
}

export function estadisticasCarnetApiAEntidad(raw: EstadisticasCarnetApiItem): EstadisticasCarnet {
  return {
    total: raw.total,
    activos: raw.activos,
    revocados: raw.revocados,
    emitidosHoy: raw.emitidos_hoy,
    emitidosMes: raw.emitidos_mes,
    ultimos: raw.ultimos ?? [],
    porMotivo: (raw.por_motivo ?? []).map((m) => ({
      motivoId: m.motivo_id,
      motivo: m.motivo,
      total: m.total,
    })),
  };
}

export function empleadoApiADatosCarnet(raw: EmpleadoCarnetApiItem): DatosCarnetEmpleado {
  const nombres = raw.nombres?.trim() || "";
  const apellidos = raw.apellidos?.trim() || "";
  const nombreCompleto = raw.nombre_completo?.trim() || `${nombres} ${apellidos}`.trim() || raw.cedula;
  return {
    cedula: raw.cedula,
    nombres,
    apellidos,
    nombreCompleto,
    codigo: raw.codigo || raw.codigo_empleado || undefined,
    cargo: raw.cargo || undefined,
    departamento: raw.departamento || undefined,
    fotoUrl: raw.foto_url || null,
  };
}

export function elementoBibliotecaApiAEntidad(raw: ElementoBibliotecaApiItem): ElementoBiblioteca {
  return {
    id: String(raw.id),
    nombre: raw.nombre,
    categoria: raw.categoria,
    archivo_url: raw.archivo_url,
    tamano_bytes: raw.tamano_bytes,
    mime_type: raw.mime_type,
    ancho_px: raw.ancho_px,
    alto_px: raw.alto_px,
    creado: raw.creado,
    creado_por: raw.creado_por ? String(raw.creado_por) : null,
    descripcion: raw.descripcion || "",
  };
}

export function campoCredencialApiAEntidad(raw: CampoCredencialApiItem): CampoCredencial {
  return {
    codigo: raw.codigo,
    etiqueta: raw.etiqueta,
    grupo: raw.grupo as GrupoCampo,
    tipo_credencial: raw.tipo_credencial,
    sensible: Boolean(raw.sensible),
    es_personalizado: Boolean(raw.es_personalizado),
    descripcion: raw.descripcion || "",
    valor_ejemplo: raw.valor_ejemplo || "",
  };
}

export function fichaQrApiAEntidad(raw: FichaQrApiItem): FichaQr {
  return {
    esValido: raw.es_valido,
    estado: raw.estado,
    mensaje: raw.mensaje,
    securityHash: raw.security_hash,
    nivelAcceso: raw.nivel_acceso,
    datos: raw.datos,
    saludDisponible: raw.salud_disponible,
    fechaEmision: raw.fecha_emision,
    fechaVencimiento: raw.fecha_vencimiento,
  };
}

/** Convierte la página del servidor ({resultados, total_paginas, ...}) a la entidad de dominio. */
export function paginaApiAEntidad<A, E>(
  raw: { resultados: A[]; total: number; pagina: number; tamano: number; total_paginas: number } | null | undefined,
  mapear: (item: A) => E,
): PaginaCarnet<E> {
  return {
    resultados: (raw?.resultados ?? []).map(mapear),
    total: raw?.total ?? 0,
    pagina: raw?.pagina ?? 1,
    tamano: raw?.tamano ?? 12,
    totalPaginas: raw?.total_paginas ?? 1,
  };
}
