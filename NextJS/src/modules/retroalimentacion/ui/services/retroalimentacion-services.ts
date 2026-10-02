import {
  crearOrganismoAdscritoAction,
  actualizarOrganismoAdscritoAction,
  crearCategoriaDiscapacidadAction,
  crearDiscapacidadAction,
  crearCategoriaPatologiaAction,
  crearPatologiaAction,
  crearCategoriaAlergiaAction,
  crearAlergiaAction,
  crearRegionTallaAction,
  crearTallaAction,
  getOrganismosAdscritosAction,
  getCategoriasDiscapacidadAction,
  getCategoriasPatologiaAction,
  getCategoriasAlergiaAction,
  getTiposPrendaAction,
  getRegionesTallaAction,
} from "@/modules/catalogos/infrastructure/actions/catalogos-actions";
import { descargarReporteExcelAction } from "@/modules/reportes/infrastructure/actions/reportes-actions";
import type { AdsType, AdsUpdateType } from "../schemas/schemaAds";
import type { CategoryGroup } from "../schemas/schemaCategory";
import type { DisabitySchema } from "../schemas/schemaDisability";
import type { PatologySchema } from "../schemas/schemaPatologys";
import type { AllergiesSchema } from "../schemas/schemaAllergies";
import type { RegionTallaSchema } from "../schemas/schemaRegionTalla";
import type { TallaSchema } from "../schemas/schemaTalla";

// Data loaders
export const getOrganismosAds = async () => {
  const items = await getOrganismosAdscritosAction();
  return {
    data: items.map((o) => ({
      id: o.id,
      Organismoadscrito: o.nombre,
    })),
  };
};

export const getCategory = async (tipo: "discapacidad" | "patologias" | "alergias") => {
  let items: { id: number; nombre: string }[] = [];
  if (tipo === "discapacidad") {
    items = await getCategoriasDiscapacidadAction();
  } else if (tipo === "patologias") {
    items = await getCategoriasPatologiaAction();
  } else {
    items = await getCategoriasAlergiaAction();
  }
  return {
    data: items.map((c) => ({
      id: c.id,
      nombre_categoria: c.nombre,
    })),
  };
};

export const getTipoPrenda = async () => {
  const items = await getTiposPrendaAction();
  return {
    data: items.map((t) => ({
      id: t.id,
      categoria: t.nombre,
    })),
  };
};

export const getRegionTalla = async () => {
  const items = await getRegionesTallaAction();
  return {
    data: items.map((r) => ({
      id: r.id,
      codigo: r.nombre,
    })),
  };
};

// Form actions
export const adsCreateActions = async (values: AdsType) => {
  const res = await crearOrganismoAdscritoAction({
    nombre: values.Organismoadscrito,
  });
  return {
    success: res.success,
    message: res.message,
  };
};

export const adsUpdateActions = async (values: AdsUpdateType) => {
  const res = await actualizarOrganismoAdscritoAction({
    id: values.id,
    nombre: values.Organismoadscrito,
  });
  return {
    success: res.success,
    message: res.message,
  };
};

export const disabilityGroup = async (values: CategoryGroup) => {
  const res = await crearCategoriaDiscapacidadAction({
    nombre: values.nombre_categoria,
  });
  return {
    success: res.success,
    message: res.message,
  };
};

export const disabilityCreateActions = async (values: DisabitySchema) => {
  const res = await crearDiscapacidadAction({
    discapacidad: values.discapacidad,
    categoria_id: values.categoria_id,
  });
  return {
    success: res.success,
    message: res.message,
  };
};

export const patologyGroup = async (values: CategoryGroup) => {
  const res = await crearCategoriaPatologiaAction({
    nombre: values.nombre_categoria,
  });
  return {
    success: res.success,
    message: res.message,
  };
};

export const patologyCreateActions = async (values: PatologySchema) => {
  const res = await crearPatologiaAction({
    patologia: values.patologia,
    categoria_id: values.categoria_id,
  });
  return {
    success: res.success,
    message: res.message,
  };
};

export const allergiesGroup = async (values: CategoryGroup) => {
  const res = await crearCategoriaAlergiaAction({
    nombre: values.nombre_categoria,
  });
  return {
    success: res.success,
    message: res.message,
  };
};

export const allergiesCreateActions = async (values: AllergiesSchema) => {
  const res = await crearAlergiaAction({
    alergia: values.alergia,
    categoria_id: values.categoria_id,
  });
  return {
    success: res.success,
    message: res.message,
  };
};

export const regionTallaCreateActions = async (values: RegionTallaSchema) => {
  const res = await crearRegionTallaAction({
    codigo: values.codigo,
  });
  return {
    success: res.success,
    message: res.message,
  };
};

export const tallaCreateActions = async (values: TallaSchema) => {
  const res = await crearTallaAction({
    valor: values.valor,
    region_id: values.region,
    tipo_prenda_id: values.tipo_prenda,
  });
  return {
    success: res.success,
    message: res.message,
  };
};

export const getExcel = async () => {
  return await descargarReporteExcelAction("personal-activo");
};
