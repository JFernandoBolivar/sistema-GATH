/**
 * Servicio de catálogos y generación de reportes adaptado a la arquitectura Onion.
 * Provee la interfaz que consumen los componentes de reporte legacy pero resolviendo
 * los datos mediante las Server Actions canónicas y la ruta /api/reports/pdf/.
 */

import {
  getCoordinacionesAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getOrganismosAdscritosAction,
} from "@/shared/infrastructure/actions/catalog-actions";

import {
  getCapacitacionesAction,
  getCarrerasAction,
  getCondicionesViviendaAction,
  getDiscapacidadesAction,
  getEstadosAction,
  getGradosAction,
  getGruposCapacitacionAction,
  getGruposSanguineosAction,
  getMencionesAction,
  getMunicipiosAction,
  getNivelesAcademicosAction,
  getParentescosAction,
  getParroquiasAction,
  getPatologiasAction,
  getRegionesAction,
  getSexosAction,
  getTiposNominaAction,
  getTiposProcedenciaAction,
} from "@/modules/catalogos/infrastructure/actions/catalogos-actions";

import {
  getDenominacionesAction,
  getDenominacionesEspecificasAction,
  getEstatusCargoAction,
} from "@/shared/infrastructure/actions/catalog-actions";

import { getDistribucionNominaAction } from "@/modules/reportes/infrastructure/actions/reportes-actions";

export interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

const wrap = <T>(data: T): ApiResponse<T> => ({
  status: "success",
  message: "OK",
  data,
});

export const getDependency = async () => {
  const items = await getDependenciasAction();
  return wrap(
    items.map((d) => ({
      id: d.id,
      Codigo: d.codigo || "",
      dependencia: d.nombre,
      nombre: d.nombre,
    })),
  );
};

export const getDirectionGeneralById = async (dependencyId?: number | string | null) => {
  const id = dependencyId ? Number(dependencyId) : undefined;
  const items = await getDireccionesGeneralesAction(id);
  return wrap(
    items.map((d) => ({
      id: d.id,
      Codigo: d.codigo || "",
      direccion_general: d.nombre,
      nombre: d.nombre,
      dependencia_id: d.dependenciaId,
    })),
  );
};

export const getDirectionLine = async (directionGeneralId?: number | string | null) => {
  const id = directionGeneralId ? Number(directionGeneralId) : undefined;
  const items = await getDireccionesLineaAction(id);
  return wrap(
    items.map((d) => ({
      id: d.id,
      Codigo: d.codigo || "",
      direccion_linea: d.nombre,
      nombre: d.nombre,
      direccion_general_id: d.direccionGeneralId,
    })),
  );
};

export const getCoordination = async (directionLineId?: number | string | null) => {
  const id = directionLineId ? Number(directionLineId) : undefined;
  const items = await getCoordinacionesAction(id);
  return wrap(
    items.map((d) => ({
      id: d.id,
      Codigo: d.codigo || "",
      coordinacion: d.nombre,
      nombre: d.nombre,
      direccion_linea_id: d.direccionLineaId,
    })),
  );
};

export const getCargo = async () => {
  const items = await getDenominacionesAction();
  return wrap(
    items.map((c) => ({
      id: c.id,
      cargo: c.nombre,
      nombre: c.nombre,
    })),
  );
};

export const getCargoEspecifico = async () => {
  const items = await getDenominacionesEspecificasAction();
  return wrap(
    items.map((c) => ({
      id: c.id,
      cargo: c.nombre,
      nombre: c.nombre,
    })),
  );
};

export const getNominaGeneral = async () => {
  const items = await getTiposNominaAction();
  return wrap(
    items.map((n) => ({
      id: n.id,
      nomina: n.nombre,
      nombre: n.nombre,
    })),
  );
};

export const getGrado = async () => {
  const items = await getGradosAction();
  return wrap(
    items.map((g) => ({
      id: g.id,
      grado: g.nombre,
      nombre: g.nombre,
    })),
  );
};

export const getSex = async () => {
  const items = await getSexosAction();
  return wrap(
    items.map((s) => ({
      id: s.id,
      sexo: s.nombre,
      nombre: s.nombre,
    })),
  );
};

export const getBloodGroup = async () => {
  const items = await getGruposSanguineosAction();
  return wrap(
    items.map((b) => ({
      id: b.id,
      GrupoSanguineo: b.nombre,
      nombre: b.nombre,
    })),
  );
};

// El DTO de catálogos no trae categoría: los reportes usan una única "General".
const CATEGORIA_GENERAL = { id: 1, nombre_categoria: "General" } as const;

export const getPatologys = async () => {
  const items = await getPatologiasAction();
  return wrap(
    items.map((p) => ({
      id: p.id,
      patologia: p.nombre,
      nombre: p.nombre,
      categoria: {
        id: CATEGORIA_GENERAL.id,
        nombre_categoria: CATEGORIA_GENERAL.nombre_categoria,
      },
    })),
  );
};

export const getDisability = async () => {
  const items = await getDiscapacidadesAction();
  return wrap(
    items.map((d) => ({
      id: d.id,
      discapacidad: d.nombre,
      nombre: d.nombre,
      categoria: {
        id: CATEGORIA_GENERAL.id,
        nombre_categoria: CATEGORIA_GENERAL.nombre_categoria,
      },
    })),
  );
};

export const getAcademyLevel = async () => {
  const items = await getNivelesAcademicosAction();
  return wrap(
    items.map((a) => ({
      id: a.id,
      nivelacademico: a.nombre,
      nombre: a.nombre,
    })),
  );
};

export const getCarrera = async (_nivelId?: number) => {
  const items = await getCarrerasAction();
  return wrap(
    items.map((c) => ({
      id: c.id,
      nombre_carrera: c.nombre,
      nombre: c.nombre,
    })),
  );
};

export const getMencion = async (carreraId?: string | number) => {
  const id = carreraId ? Number(carreraId) : undefined;
  const items = await getMencionesAction(id);
  return wrap(
    items.map((m) => ({
      id: m.id,
      nombre_mencion: m.nombre,
      nombre: m.nombre,
    })),
  );
};

export const getCapacitaciones = async () => {
  const items = await getCapacitacionesAction();
  return wrap(
    items.map((c) => ({
      id: c.id,
      nombre_capacitacion: c.nombre,
      nombre: c.nombre,
    })),
  );
};

export const getTiposProcedencia = async () => {
  const items = await getTiposProcedenciaAction();
  return wrap(
    items.map((p) => ({
      id: p.id,
      tipo_procedencia: p.nombre,
      nombre: p.nombre,
    })),
  );
};

export const getGruposCapacitacion = async () => {
  const items = await getGruposCapacitacionAction();
  return wrap(
    items.map((g) => ({
      id: g.id,
      nombre_grupo: g.nombre,
      nombre: g.nombre,
    })),
  );
};

export const getRegion = async () => {
  const items = await getRegionesAction();
  return wrap(
    items.map((r) => ({
      id: r.id,
      region: r.nombre,
      nombre: r.nombre,
    })),
  );
};

export const getStateByRegion = async (regionId?: number) => {
  const items = await getEstadosAction(regionId);
  return wrap(
    items.map((s) => ({
      id: s.id,
      estado: s.nombre,
      nombre: s.nombre,
      region_id: s.regionId,
    })),
  );
};

export const getMunicipalitys = async (stateId?: string | number) => {
  const id = stateId ? Number(stateId) : undefined;
  const items = await getMunicipiosAction(id);
  return wrap(
    items.map((m) => ({
      id: m.id,
      municipio: m.nombre,
      nombre: m.nombre,
      estado_id: m.estadoId,
    })),
  );
};

export const getParish = async (municipalityId?: string | number) => {
  const id = municipalityId ? Number(municipalityId) : undefined;
  const items = await getParroquiasAction(id);
  return wrap(
    items.map((p) => ({
      id: p.id,
      parroquia: p.nombre,
      nombre: p.nombre,
      municipio_id: p.municipioId,
    })),
  );
};

export const getConditionDwelling = async () => {
  const items = await getCondicionesViviendaAction();
  return wrap(
    items.map((c) => ({
      id: c.id,
      condicion: c.nombre,
      nombre: c.nombre,
    })),
  );
};

export const getOrganismosAds = async () => {
  const items = await getOrganismosAdscritosAction();
  return wrap(
    items.map((o) => ({
      id: o.id,
      Organismoadscrito: o.nombre,
      nombre: o.nombre,
    })),
  );
};

export const getOrganismosAdsFather = getOrganismosAds;

export const getParent = async () => {
  const items = await getParentescosAction();
  return wrap(
    items.map((p) => ({
      id: p.id,
      descripcion_parentesco: p.nombre,
      nombre: p.nombre,
    })),
  );
};

export const getStatusReport = async () => {
  const items = await getEstatusCargoAction();
  return wrap(
    items.map((s) => ({
      id: s.id,
      estatus: s.nombre,
      nombre: s.nombre,
    })),
  );
};

export const getReportTypeNomina = async () => {
  const items = await getDistribucionNominaAction();
  return wrap(
    items.map((i) => ({
      tiponominaid__nomina: i.tipoNomina,
      count: i.total,
    })),
  );
};

export interface ResultadoReportePdf {
  blob: Blob;
  /** Total de registros que cumplen los filtros (antes del tope). */
  total: number | null;
  /** Tope de filas configurado en el backend. */
  limite: number | null;
  /** `true` si el documento se cortó al alcanzar el tope. */
  truncado: boolean;
}

function numeroDeCabecera(valor: string | null): number | null {
  if (valor === null || valor.trim() === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export const postReport = async <T>(values: T): Promise<ResultadoReportePdf> => {
  const response = await fetch("/api/reports/pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    const cuerpo = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(cuerpo?.error?.trim() || "Error al generar el reporte en PDF.");
  }

  return {
    blob: await response.blob(),
    total: numeroDeCabecera(response.headers.get("X-Reporte-Total-Registros")),
    limite: numeroDeCabecera(response.headers.get("X-Reporte-Limite")),
    truncado: response.headers.get("X-Reporte-Truncado") === "true",
  };
};

export const postReportPasivo = postReport;
