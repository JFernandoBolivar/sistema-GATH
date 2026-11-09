/**
 * Implementación del repositorio de Pasivos usando la API REST.
 */
import type { RepoPasivos } from "../../domain/ports/repo-pasivos";
import type { ActualizarPasivoInput, FiltrosPasivos } from "../../domain/entities/pasivo";
import type { ProcesarEgresoInput } from "../../domain/ports/procesar-egreso";
import { pasivosApi } from "../http/pasivos-api";
import {
  catalogoPasivoApiAEntidad,
  catalogosExpedienteApiAEntidad,
  paginaPasivosApiAEntidad,
  pasivoApiAEntidad,
} from "../mappers/mapper-pasivos";

export const repoPasivosApi: RepoPasivos = {
  async listarPasivos(busqueda) {
    const page = await pasivosApi.getPasivos({ nombre: busqueda, limit: 50 });
    return (page.data?.results ?? []).map(pasivoApiAEntidad);
  },

  async listarPasivosPaginados(filtros: FiltrosPasivos) {
    const page = await pasivosApi.getPasivos({
      cedula: filtros.cedula,
      nombre: filtros.nombre,
      codigo: filtros.codigo,
      tipo_nomina_id: filtros.tipoNominaId,
      motivo_id: filtros.motivoId,
      fecha_desde: filtros.fechaDesde,
      fecha_hasta: filtros.fechaHasta,
      sin_cuenta: filtros.sinCuenta,
      limit: filtros.limit,
      offset: filtros.offset,
    });
    return paginaPasivosApiAEntidad(page.data);
  },

  async actualizarPasivo(cedula: string, input: ActualizarPasivoInput) {
    const raw = await pasivosApi.actualizar(cedula, {
      nombres: input.nombres,
      apellidos: input.apellidos,
      correo: input.correo,
      correo_alternativo: input.correoAlternativo,
      telefono_movil: input.telefonoMovil,
      telefono_habitacion: input.telefonoHabitacion,
      carnet_patria: input.carnetPatria,
      carnet_patria_serial: input.carnetPatriaSerial,
      fecha_nacimiento: input.fechaNacimiento,
      estado_civil_id: input.estadoCivilId,
      nacionalidad_id: input.nacionalidadId,
    });
    return pasivoApiAEntidad(raw);
  },

  async obtenerPorCedula(cedula) {
    const raw = await pasivosApi.getPorCedula(cedula);
    return pasivoApiAEntidad(raw);
  },

  async descargarPdf(cedula) {
    return pasivosApi.getPdf(cedula);
  },

  async procesarEgreso(cedula, input: ProcesarEgresoInput) {
    const raw = await pasivosApi.procesarEgreso(cedula, {
      motivo_movimiento_id: input.motivoMovimientoId,
      tipo_nomina_id: input.tipoNominaId,
      liberar_activos: input.liberarActivos,
      ...(input.fechaEgreso ? { fecha_egreso: input.fechaEgreso } : {}),
    });
    return pasivoApiAEntidad(raw);
  },

  async egresarPasivo(cedula: string, motivoId: number, familiarIds: number[]) {
    const raw = await pasivosApi.egresarPasivo(cedula, motivoId, familiarIds);
    return pasivoApiAEntidad(raw);
  },

  async getFamiliaresTitular(cedula: string) {
    const raw = await pasivosApi.getFamiliaresTitular(cedula);
    return raw.map((f) => ({
      id: f.id,
      cedulaFamiliar: f.cedula_familiar,
      nombreCompleto: [f.primer_nombre, f.segundo_nombre, f.primer_apellido, f.segundo_apellido].filter(Boolean).join(' '),
      heredero: f.heredero,
    }));
  },

  async registrarSobrevivientes(cedula: string, familiarIds: number[]) {
    const raw = await pasivosApi.registrarSobrevivientes(cedula, familiarIds);
    return raw.map((r) => ({ cedula: r.cedula, nombreCompleto: r.nombre_completo, creado: r.creado }));
  },

  async registrarPasivo(input) {
    const raw = await pasivosApi.crear({
      cedula: input.cedula,
      nombres: input.nombres,
      apellidos: input.apellidos,
      sexo_id: input.sexoId,
      fecha_nacimiento: input.fechaNacimiento,
      tipo_nomina_id: input.tipoNominaId,
      motivo_id: input.motivoId,
      fecha_vigencia: input.fechaVigencia,
      estado_civil_id: input.estadoCivilId,
      nacionalidad_id: input.nacionalidadId,
      correo: input.correo,
      correo_alternativo: input.correoAlternativo,
      telefono_movil: input.telefonoMovil,
      telefono_habitacion: input.telefonoHabitacion,
      carnet_patria: input.carnetPatria,
      carnet_patria_serial: input.carnetPatriaSerial,
      datos_vivienda: input.datosVivienda,
      perfil_salud: input.perfilSalud,
      perfil_fisico: input.perfilFisico,
      formacion_academica: input.formacionAcademica,
      formacion_complementaria: input.formacionComplementaria,
      contacto_emergencia: input.contactoEmergencia,
      antecedentes: input.antecedentes,
    });
    return pasivoApiAEntidad(raw);
  },

  async listarSexos() {
    return (await pasivosApi.getSexos()).map(catalogoPasivoApiAEntidad);
  },

  async listarEstadosCiviles() {
    return (await pasivosApi.getEstadosCiviles()).map(catalogoPasivoApiAEntidad);
  },

  async listarNacionalidades() {
    return (await pasivosApi.getNacionalidades()).map(catalogoPasivoApiAEntidad);
  },

  async listarEstados() {
    return (await pasivosApi.getEstados()).map(catalogoPasivoApiAEntidad);
  },

  async listarMunicipios() {
    return (await pasivosApi.getMunicipios()).map(catalogoPasivoApiAEntidad);
  },

  async listarParroquias() {
    return (await pasivosApi.getParroquias()).map(catalogoPasivoApiAEntidad);
  },

  async listarTiposNomina(soloPasivos: boolean = true) {
    const raw = await pasivosApi.getTiposNomina(soloPasivos);
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
