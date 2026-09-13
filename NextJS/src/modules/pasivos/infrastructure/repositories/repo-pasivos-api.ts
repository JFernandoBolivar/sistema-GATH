/**
 * Implementación del repositorio de Pasivos usando la API REST.
 */
import type { RepoPasivos } from "../../domain/ports/repo-pasivos";
import type { ProcesarEgresoInput } from "../../domain/ports/procesar-egreso";
import { pasivosApi } from "../http/pasivos-api";
import {
  catalogoPasivoApiAEntidad,
  catalogosExpedienteApiAEntidad,
  pasivoApiAEntidad,
} from "../mappers/mapper-pasivos";

export const repoPasivosApi: RepoPasivos = {
  async listarPasivos(busqueda) {
    const raw = await pasivosApi.getPasivos(busqueda);
    return raw.map(pasivoApiAEntidad);
  },

  async obtenerPorCedula(cedula) {
    const raw = await pasivosApi.getPorCedula(cedula);
    return pasivoApiAEntidad(raw);
  },

  async procesarEgreso(cedula, input: ProcesarEgresoInput) {
    const raw = await pasivosApi.procesarEgreso(cedula, {
      motivo_movimiento_id: input.motivoMovimientoId,
      tipo_nomina_id: input.tipoNominaId,
      liberar_activos: input.liberarActivos,
    });
    return pasivoApiAEntidad(raw);
  },

  async listarMotivosEgreso() {
    const raw = await pasivosApi.getMotivosEgreso();
    return raw.map(catalogoPasivoApiAEntidad);
  },

  async listarTiposNomina() {
    const raw = await pasivosApi.getTiposNomina();
    return raw.map(catalogoPasivoApiAEntidad);
  },

  async listarCatalogosExpediente() {
    const [
      estados,
      municipios,
      parroquias,
      condicionesVivienda,
      codigosPostales,
      gruposSanguineos,
      alergias,
      patologias,
      discapacidades,
      tallas,
      nivelesAcademicos,
      carreras,
      menciones,
      instituciones,
      politicas,
    ] = await Promise.all([
      pasivosApi.getEstados(),
      pasivosApi.getMunicipios(),
      pasivosApi.getParroquias(),
      pasivosApi.getCondicionesVivienda(),
      pasivosApi.getCodigosPostales(),
      pasivosApi.getGruposSanguineos(),
      pasivosApi.getAlergias(),
      pasivosApi.getPatologias(),
      pasivosApi.getDiscapacidades(),
      pasivosApi.getTallas(),
      pasivosApi.getNivelesAcademicos(),
      pasivosApi.getCarreras(),
      pasivosApi.getMenciones(),
      pasivosApi.getInstituciones(),
      pasivosApi.getPoliticas(),
    ]);
    return catalogosExpedienteApiAEntidad({
      estados,
      municipios,
      parroquias,
      condicionesVivienda,
      codigosPostales,
      gruposSanguineos,
      alergias,
      patologias,
      discapacidades,
      tallas,
      nivelesAcademicos,
      carreras,
      menciones,
      instituciones,
      politicas,
    });
  },
};
